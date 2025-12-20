import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/user/avatar");

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createSupabaseAdmin(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 2MB" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Generate file path: {userId}/avatar.{ext}
    const ext = file.type.split("/")[1];
    const filePath = `${user.id}/avatar.${ext}`;

    // Delete old avatar if exists (any extension)
    const { data: existingFiles } = await supabaseAdmin.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("avatars").remove(filesToDelete);
    }

    // Upload new avatar
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      log.error({ error: uploadError }, "Avatar upload failed");
      return NextResponse.json(
        { message: "Failed to upload avatar" },
        { status: 500 },
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);

    // Update user record
    await db.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: publicUrl,
        avatarSource: "upload",
      },
    });

    log.info({ userId: user.id }, "Avatar uploaded successfully");

    return NextResponse.json({ avatarUrl: publicUrl });
  } catch (error) {
    log.error({ error }, "Avatar upload error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Delete avatar files
    const { data: existingFiles } = await supabaseAdmin.storage
      .from("avatars")
      .list(user.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("avatars").remove(filesToDelete);
    }

    // Clear avatar from user record
    await db.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: null,
        avatarSource: null,
      },
    });

    log.info({ userId: user.id }, "Avatar deleted successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, "Avatar delete error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
