import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SEED_USER = {
  email: "seed@preview.abode.fyi",
  password: "preview-seed-123!",
  username: "seed_user",
  firstName: "Seed",
  lastName: "User",
};

const ASSETS_DIR = path.join(__dirname, "seed-assets");

function getSupabaseAdmin() {
  const strip = (v: string | undefined) => v?.replace(/^"|"$/g, "");
  const supabaseUrl = strip(process.env.SUPABASE_URL);
  const nextPublicUrl = strip(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const url = supabaseUrl ?? nextPublicUrl;
  const key = strip(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Remove any existing seed user before creating a fresh one. We delete directly
// from auth.users by email (raw SQL) because admin.listUsers() omits
// soft-deleted / email-reserved users — yet their email still blocks createUser
// with "already registered". The on_auth_user_deleted trigger removes the
// matching public.users row, which cascades to its items/rooms.
async function deleteExistingSeedUser(prisma: PrismaClient) {
  await prisma.$executeRaw`DELETE FROM auth.users WHERE email = ${SEED_USER.email}`;
}

async function createSeedUser(
  supabase: SupabaseClient,
  prisma: PrismaClient,
): Promise<string> {
  await deleteExistingSeedUser(prisma);

  const { data, error } = await supabase.auth.admin.createUser({
    email: SEED_USER.email,
    password: SEED_USER.password,
    email_confirm: true,
    user_metadata: { pending_username: SEED_USER.username },
  });

  if (error || !data?.user) {
    throw new Error(
      `Failed to create seed user: ${error?.message ?? "unknown error"}`,
    );
  }

  const userId = data.user.id;

  // The handle_new_user trigger creates the public.users row.
  // Wait briefly for the trigger to fire, then update with seed data.
  await new Promise((resolve) => setTimeout(resolve, 500));

  await prisma.user.update({
    where: { id: userId },
    data: {
      username: SEED_USER.username,
      firstName: SEED_USER.firstName,
      lastName: SEED_USER.lastName,
      onboardingCompletedAt: new Date(),
    },
  });

  return userId;
}

async function uploadSeedImage(
  supabase: SupabaseClient,
  userId: string,
  filename: string,
  contentType: string,
): Promise<{ fileKey: string; size: number }> {
  const filePath = path.join(ASSETS_DIR, filename);
  const buffer = readFileSync(filePath);
  const ext = path.extname(filename);
  const fileKey = `${userId}/seed-${filename.replace(ext, "")}-${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from("items")
    .upload(fileKey, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload ${filename}: ${error.message}`);
  }

  return { fileKey, size: buffer.length };
}

async function seed() {
  console.log("Starting preview seed...");

  // Use the session-mode (direct) connection for this one-off script. The
  // transaction-mode pooler (DATABASE_URL, port 6543) breaks Prisma's prepared
  // statements ("prepared statement already exists"); DIRECT_URL (5432) doesn't.
  const prisma = new PrismaClient(
    process.env.DIRECT_URL
      ? { datasourceUrl: process.env.DIRECT_URL }
      : undefined,
  );
  const supabase = getSupabaseAdmin();

  try {
    console.log("Creating seed user...");
    const userId = await createSeedUser(supabase, prisma);
    console.log(`Seed user created: ${userId}`);

    // Upload images to Supabase Storage
    console.log("Uploading seed images...");

    const spiralUpload = await uploadSeedImage(
      supabase,
      userId,
      "spiral-orange.jpeg",
      "image/jpeg",
    );

    const meshUpload = await uploadSeedImage(
      supabase,
      userId,
      "mesh-branding.jpeg",
      "image/jpeg",
    );

    const gifUpload = await uploadSeedImage(
      supabase,
      userId,
      "roots-faq.gif",
      "image/gif",
    );

    console.log("Seed images uploaded");
    console.log("Creating seed items...");

    // --- IMAGE ITEMS ---

    const spiralItem = await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: spiralUpload.fileKey,
        title: "Push Back — Spiral Typography",
        description:
          "Bold orange spiral design on a dark wall featuring the words 'PUSH BACK' integrated into concentric circles.",
        tags: [
          "typography",
          "street art",
          "orange",
          "spiral",
          "graphic design",
          "mural",
        ],
        meta: {
          originalName: "Spiral Orange Symbol Design.jpeg",
          size: spiralUpload.size,
          type: "image/jpeg",
          width: 1080,
          height: 1350,
        },
        imageDetails: {
          create: {
            objects: ["wall", "sign", "art"],
            colors: [
              {
                hex: "#E8641B",
                name: "orange",
                score: 0.45,
                l: 57,
                a: 52,
                b: 62,
              },
              { hex: "#1A1A1A", name: "black", score: 0.42, l: 10, a: 0, b: 0 },
              {
                hex: "#D4561A",
                name: "dark orange",
                score: 0.08,
                l: 48,
                a: 44,
                b: 52,
              },
            ],
            ocrText: "PUSH BACK",
          },
        },
      },
    });

    const meshItem = await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: meshUpload.fileKey,
        title: "Mesh Branding Close-up",
        description:
          "Macro shot of the Mesh logo printed on material, with a subtle vignette and chromatic detail.",
        tags: ["branding", "logo", "macro", "typography", "product", "detail"],
        meta: {
          originalName: "Close-up of Mesh Branding.jpeg",
          size: meshUpload.size,
          type: "image/jpeg",
          width: 1200,
          height: 675,
        },
        imageDetails: {
          create: {
            objects: ["text", "logo"],
            colors: [
              { hex: "#C8C8C8", name: "silver", score: 0.5, l: 80, a: 0, b: 0 },
              {
                hex: "#333333",
                name: "dark gray",
                score: 0.25,
                l: 20,
                a: 0,
                b: 0,
              },
              { hex: "#CC3333", name: "red", score: 0.1, l: 40, a: 55, b: 35 },
            ],
            ocrText: "MESH",
          },
        },
      },
    });

    await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: gifUpload.fileKey,
        title: "Roots Loan Assumption FAQ",
        description:
          "Animated FAQ graphic explaining loan assumption from Roots, with step-by-step visual walkthrough.",
        tags: ["finance", "faq", "animated", "infographic", "real estate"],
        meta: {
          originalName: "Roots Loan Assumption FAQ.gif",
          size: gifUpload.size,
          type: "image/gif",
          width: 800,
          height: 600,
        },
        imageDetails: {
          create: {
            objects: ["text", "graphic"],
            colors: [
              { hex: "#FFFFFF", name: "white", score: 0.6, l: 100, a: 0, b: 0 },
              {
                hex: "#2D5F2D",
                name: "green",
                score: 0.2,
                l: 37,
                a: -30,
                b: 25,
              },
            ],
          },
        },
      },
    });

    // --- ARTICLE ITEM ---

    const articleItem = await prisma.item.create({
      data: {
        userId,
        kind: "article",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://www.paulgraham.com/start.html",
        title: "How to Start a Startup",
        description:
          "You need three things to create a successful startup: to start with good people, to make something customers actually want, and to spend as little money as possible.",
        tags: [
          "startups",
          "essay",
          "entrepreneurship",
          "paul graham",
          "advice",
        ],
        meta: { originalName: "How to Start a Startup" },
        externalLinks: [
          { url: "https://www.paulgraham.com/start.html", platform: "web" },
        ],
        articleDetails: {
          create: {
            author: "Paul Graham",
            domain: "paulgraham.com",
            publishedAt: new Date("2005-03-01"),
            readingTime: 25,
            content: null,
          },
        },
      },
    });

    // --- TWEET ITEMS ---

    // Tweet with multiple images
    const tweetMultiImage = await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/youwillmakemaps/status/2037768343349080182",
        title: "Tweet by @youwillmakemaps",
        description: "The world craves amber.",
        tags: ["maps", "cartography", "amber", "photography"],
        externalLinks: [
          {
            url: "https://x.com/youwillmakemaps/status/2037768343349080182",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "2037768343349080182",
            authorName: "Evan Applegate",
            authorUsername: "youwillmakemaps",
            authorAvatarUrl:
              "https://pbs.twimg.com/profile_images/1899462242137161728/MBcOeNTL_normal.png",
            text: "The world craves amber.",
            postedAt: new Date("2026-03-28T05:46:47.000Z"),
            media: [
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/HEea_ZDaoAAJjzS.jpg",
                width: 2731,
                height: 4096,
              },
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/HEebQX6bwAArV94.jpg",
                width: 3024,
                height: 4032,
              },
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/HEebWT7a4AAmFw6.jpg",
                width: 2810,
                height: 4096,
              },
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/HEebfK-asAAiPWv.jpg",
                width: 4096,
                height: 2323,
              },
            ],
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Tweet with single image
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/biancodavinci/status/2029957776693207118",
        title: "Tweet by @BiancoDavinci",
        description:
          "View from a window at the Mill Valley Public Library in California.",
        tags: [
          "photography",
          "library",
          "california",
          "landscape",
          "architecture",
        ],
        externalLinks: [
          {
            url: "https://x.com/biancodavinci/status/2029957776693207118",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "2029957776693207118",
            authorName: "DaVinci",
            authorUsername: "BiancoDavinci",
            authorAvatarUrl:
              "https://pbs.twimg.com/profile_images/1906685221778374656/tU2D_wLF_normal.jpg",
            text: "View from a window at the Mill Valley Public Library in California.",
            postedAt: new Date("2026-03-06T16:30:23.000Z"),
            media: [
              {
                type: "photo",
                url: "https://pbs.twimg.com/media/HCvb05ZXIAMqN8J.jpg",
                width: 1080,
                height: 1334,
              },
            ],
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Tweet with link card
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/nbaschez/status/2034444963656933683",
        title: "Tweet by @nbaschez",
        description:
          "This is the most interesting thing I've read in like 3 years",
        tags: ["startups", "punditry", "entrepreneurship", "reading"],
        externalLinks: [
          {
            url: "https://x.com/nbaschez/status/2034444963656933683",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "2034444963656933683",
            authorName: "Nathan Baschez",
            authorUsername: "nbaschez",
            authorAvatarUrl:
              "https://pbs.twimg.com/profile_images/1694966386957938688/PtayrF_x_normal.jpg",
            text: "This is the most interesting thing I've read in like 3 years",
            postedAt: new Date("2026-03-19T01:40:52.000Z"),
            media: Prisma.JsonNull,
            quotedTweetId: null,
            card: {
              title: "Startup Punditry's 25 Years of Failure",
              description:
                "Startup pundits sold us a failed science of entrepreneurship. The Red Queen offers something better.",
              url: "https://colossus.com/article/we-have-learned-nothing-startup-pundits/",
              imageUrl:
                "https://pbs.twimg.com/card_img/2036410874752024576/um9fgKpu?format=jpg&name=800x419",
            },
          },
        },
      },
    });

    // Tweet with no images
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/marclou/status/2030300952025256231",
        title: "Tweet by @marclou",
        description: "Every great startup began as a bad idea.",
        tags: ["startups", "ideas", "entrepreneurship"],
        externalLinks: [
          {
            url: "https://x.com/marclou/status/2030300952025256231",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "2030300952025256231",
            authorName: "Marc Lou",
            authorUsername: "marclou",
            authorAvatarUrl:
              "https://pbs.twimg.com/profile_images/1514863683574599681/9k7PqDTA_normal.jpg",
            text: "Every great startup began as a bad idea.",
            postedAt: new Date("2026-03-07T15:14:02.000Z"),
            media: Prisma.JsonNull,
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Twitter Article
    await prisma.item.create({
      data: {
        userId,
        kind: "article",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/WillManidis/status/2023405488277508141",
        title: "Twitter Article",
        description: "Twitter Article (content not available for preview)",
        tags: ["history", "article"],
        meta: {
          twitterArticleId: "2023405488277508141",
          originalUrl: "https://x.com/WillManidis/status/2023405488277508141",
        },
        externalLinks: [
          {
            url: "https://x.com/WillManidis/status/2023405488277508141",
            platform: "twitter",
          },
        ],
        articleDetails: {
          create: {
            domain: "x.com",
            content: null,
            readingTime: null,
            author: null,
            publishedAt: null,
          },
        },
      },
    });

    // --- VIDEO ITEMS ---

    // YouTube video
    const youtubeItem = await prisma.item.create({
      data: {
        userId,
        kind: "video",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://www.youtube.com/watch?v=4iQmPv_dTI0",
        title: "Fred again..: Tiny Desk Concert",
        tags: ["music", "live", "tiny desk", "electronic", "concert"],
        meta: { originalName: "Fred again..: Tiny Desk Concert" },
        externalLinks: [
          {
            url: "https://www.youtube.com/watch?v=4iQmPv_dTI0",
            platform: "youtube",
          },
        ],
        videoDetails: {
          create: {
            platform: "youtube",
            videoId: "4iQmPv_dTI0",
            channelName: "NPR Music",
            channelUrl: "https://www.youtube.com/@nprmusic",
            duration: null,
            embedUrl: "https://www.youtube-nocookie.com/embed/4iQmPv_dTI0",
            thumbnailUrl: "https://i.ytimg.com/vi/4iQmPv_dTI0/hqdefault.jpg",
          },
        },
      },
    });

    // Vimeo video
    await prisma.item.create({
      data: {
        userId,
        kind: "video",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://vimeo.com/78837099",
        title: "Momentum Youth Church — Launch Video",
        tags: ["video", "promo", "youth", "church", "community"],
        meta: { originalName: "Momentum Youth Church — Launch Video" },
        externalLinks: [
          { url: "https://vimeo.com/78837099", platform: "vimeo" },
        ],
        videoDetails: {
          create: {
            platform: "vimeo",
            videoId: "78837099",
            channelName: "Fred Rivett",
            channelUrl: "https://vimeo.com/fredrivett",
            duration: 141,
            embedUrl: "https://player.vimeo.com/video/78837099",
            thumbnailUrl:
              "https://i.vimeocdn.com/video/454379595-02813f38ecad3ed7cf07e37b7fc536d241dec188c870426158bcf97f639b5c78-d_640",
          },
        },
      },
    });

    // --- PRODUCT ITEM ---

    await prisma.item.create({
      data: {
        userId,
        kind: "product",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://www.audio-technica.com/en-gb/at-lp120xusb",
        title: "AT-LP120XUSB Direct-Drive Turntable",
        description:
          "Direct-drive turntable with USB output for digitising vinyl. Features adjustable anti-skate, variable pitch control, and a built-in phono preamp.",
        tags: [
          "turntable",
          "vinyl",
          "audio",
          "audio-technica",
          "music",
          "product",
        ],
        meta: { originalName: "AT-LP120XUSB Direct-Drive Turntable" },
        externalLinks: [
          {
            url: "https://www.audio-technica.com/en-gb/at-lp120xusb",
            platform: "web",
          },
        ],
        productDetails: {
          create: {
            domain: "audio-technica.com",
            brand: "Audio-Technica",
            price: "299.00",
            currency: "GBP",
            availability: "in stock",
            images: [],
          },
        },
      },
    });

    // --- USER STATS ---

    const totalItems = 12;
    const totalStorage =
      BigInt(spiralUpload.size) +
      BigInt(meshUpload.size) +
      BigInt(gifUpload.size);

    await prisma.user.update({
      where: { id: userId },
      data: {
        itemCount: totalItems,
        storageUsedBytes: totalStorage,
      },
    });

    // --- ROOMS ---

    const designRoom = await prisma.room.create({
      data: {
        userId,
        name: "Design Inspiration",
        slug: "design-inspiration",
        emoji: "🎨",
        type: "manual",
        visibility: "private",
        roomItems: {
          create: [
            { itemId: spiralItem.id },
            { itemId: meshItem.id },
            { itemId: articleItem.id },
          ],
        },
      },
    });

    const mapsRoom = await prisma.room.create({
      data: {
        userId,
        name: "Maps & Geography",
        slug: "maps-and-geography",
        emoji: "🗺️",
        type: "manual",
        visibility: "public",
        roomItems: {
          create: [{ itemId: tweetMultiImage.id }],
        },
      },
    });

    const musicRoom = await prisma.room.create({
      data: {
        userId,
        name: "Music",
        slug: "music",
        emoji: "🎵",
        type: "manual",
        visibility: "private",
        roomItems: {
          create: [{ itemId: youtubeItem.id }],
        },
      },
    });

    const smartRoom = await prisma.room.create({
      data: {
        userId,
        name: "All Videos",
        slug: "all-videos",
        emoji: "📺",
        type: "smart",
        visibility: "private",
        filters: { kind: ["video"] },
      },
    });

    // --- MILESTONES ---

    await prisma.userMilestone.createMany({
      data: [
        { userId, type: "complete_profile" },
        { userId, type: "upload_first_image" },
        { userId, type: "save_first_url" },
        { userId, type: "create_first_room" },
      ],
    });

    console.log("Preview seed complete!");
    console.log(`  Email: ${SEED_USER.email}`);
    console.log(`  Password: ${SEED_USER.password}`);
    console.log(
      `  Items: ${totalItems} (3 images, 2 articles, 4 tweets, 2 videos, 1 product)`,
    );
    console.log(
      `  Rooms: ${designRoom.name}, ${mapsRoom.name}, ${musicRoom.name}, ${smartRoom.name}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
