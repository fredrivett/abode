import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SEED_USER = {
  email: "seed@preview.abode.fyi",
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

// Remove any existing seed user before creating a fresh one.
async function deleteExistingSeedUser(prisma: PrismaClient) {
  const existing = await prisma.user.findUnique({
    where: { email: SEED_USER.email },
    select: { id: true },
  });
  if (existing) {
    // items_user_id_fkey is ON DELETE RESTRICT, so the user's items must be
    // removed first. Deleting items cascades their children (locations, vectors,
    // details, room links), clearing every remaining user-RESTRICT reference.
    await prisma.item.deleteMany({ where: { userId: existing.id } });
  }
  // Free the reserved email. Raw SQL sees soft-deleted auth rows that
  // admin.listUsers() omits; the on_auth_user_deleted trigger then removes the
  // public.users row, cascading the remaining (rooms, milestones, …) FKs.
  await prisma.$executeRaw`DELETE FROM auth.users WHERE email = ${SEED_USER.email}`;
}

async function createSeedUser(
  supabase: SupabaseClient,
  prisma: PrismaClient,
): Promise<string> {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_USER_PASSWORD is not set — set it in your environment (and in the Vercel preview env) to run the preview seed.",
    );
  }

  await deleteExistingSeedUser(prisma);

  const { data, error } = await supabase.auth.admin.createUser({
    email: SEED_USER.email,
    password,
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

    const redArchUpload = await uploadSeedImage(
      supabase,
      userId,
      "red-arch-sculpture.jpg",
      "image/jpeg",
    );

    const atriumUpload = await uploadSeedImage(
      supabase,
      userId,
      "glass-atrium-roof.jpg",
      "image/jpeg",
    );

    const sunsetUpload = await uploadSeedImage(
      supabase,
      userId,
      "city-sunset-river.jpg",
      "image/jpeg",
    );

    const gifUpload = await uploadSeedImage(
      supabase,
      userId,
      "muybridge-horse.gif",
      "image/gif",
    );

    const mobyCoverUpload = await uploadSeedImage(
      supabase,
      userId,
      "book-moby-dick.jpg",
      "image/jpeg",
    );

    const willowsCoverUpload = await uploadSeedImage(
      supabase,
      userId,
      "book-wind-in-the-willows.jpg",
      "image/jpeg",
    );

    console.log("Seed images uploaded");
    console.log("Creating seed items...");

    // --- IMAGE ITEMS ---

    const redArchItem = await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: redArchUpload.fileKey,
        title: "Red Arch Sculpture",
        description:
          "A bold red circular canopy arching over a footbridge, framed by blue glass towers under a clear sky.",
        tags: [
          "architecture",
          "sculpture",
          "red",
          "city",
          "bridge",
          "photography",
        ],
        meta: {
          originalName: "red-arch-sculpture.jpg",
          size: redArchUpload.size,
          type: "image/jpeg",
          width: 1920,
          height: 2400,
        },
        imageDetails: {
          create: {
            objects: ["bridge", "sculpture", "building", "water"],
            colors: [
              {
                hex: "#D93A1E",
                name: "red",
                score: 0.4,
                l: 48,
                a: 62,
                b: 52,
              },
              {
                hex: "#3E6E8C",
                name: "blue",
                score: 0.35,
                l: 44,
                a: -8,
                b: -24,
              },
              { hex: "#1A1A1A", name: "black", score: 0.12, l: 10, a: 0, b: 0 },
            ],
          },
        },
      },
    });

    const atriumItem = await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: atriumUpload.fileKey,
        title: "Glass Atrium Roof",
        description:
          "Looking straight up at a symmetric steel-and-glass atrium roof, curved lattice beams converging against a blue sky.",
        tags: [
          "architecture",
          "geometry",
          "glass",
          "steel",
          "symmetry",
          "photography",
        ],
        meta: {
          originalName: "glass-atrium-roof.jpg",
          size: atriumUpload.size,
          type: "image/jpeg",
          width: 1920,
          height: 2557,
        },
        imageDetails: {
          create: {
            objects: ["ceiling", "glass", "structure", "light"],
            colors: [
              {
                hex: "#4A7A9C",
                name: "blue",
                score: 0.5,
                l: 49,
                a: -6,
                b: -22,
              },
              {
                hex: "#2A2A2A",
                name: "dark gray",
                score: 0.3,
                l: 17,
                a: 0,
                b: 0,
              },
              {
                hex: "#E8A63C",
                name: "amber",
                score: 0.08,
                l: 72,
                a: 20,
                b: 62,
              },
            ],
          },
        },
      },
    });

    const sunsetItem = await prisma.item.create({
      data: {
        userId,
        kind: "image",
        processingStatus: "completed",
        sourceType: "upload",
        fileKey: sunsetUpload.fileKey,
        title: "City Sunset over the River",
        description:
          "A city skyline silhouetted against a pink-and-orange sunset over the river, a boat passing in the foreground.",
        tags: [
          "sunset",
          "skyline",
          "city",
          "river",
          "silhouette",
          "photography",
        ],
        meta: {
          originalName: "city-sunset-river.jpg",
          size: sunsetUpload.size,
          type: "image/jpeg",
          width: 1920,
          height: 2558,
        },
        imageDetails: {
          create: {
            objects: ["sky", "building", "water", "boat"],
            colors: [
              {
                hex: "#E67A3C",
                name: "orange",
                score: 0.38,
                l: 62,
                a: 34,
                b: 56,
              },
              {
                hex: "#2B3A5C",
                name: "dark blue",
                score: 0.34,
                l: 25,
                a: 4,
                b: -26,
              },
              {
                hex: "#14161F",
                name: "black",
                score: 0.18,
                l: 8,
                a: 1,
                b: -6,
              },
            ],
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
        title: "The Horse in Motion",
        description:
          "Eadweard Muybridge's 1878 chronophotography study of a galloping horse and rider — the pioneering motion sequence often called the first movie.",
        tags: [
          "animation",
          "history",
          "photography",
          "motion",
          "black and white",
          "vintage",
        ],
        meta: {
          originalName: "muybridge-horse.gif",
          size: gifUpload.size,
          type: "image/gif",
          width: 498,
          height: 374,
        },
        imageDetails: {
          create: {
            objects: ["horse", "person", "animal"],
            colors: [
              {
                hex: "#E8E4DA",
                name: "off-white",
                score: 0.52,
                l: 91,
                a: 0,
                b: 4,
              },
              {
                hex: "#2A2622",
                name: "black",
                score: 0.3,
                l: 15,
                a: 1,
                b: 3,
              },
              {
                hex: "#8A857C",
                name: "gray",
                score: 0.12,
                l: 55,
                a: 0,
                b: 4,
              },
            ],
          },
        },
      },
    });

    // --- ARTICLE ITEM ---

    await prisma.item.create({
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

    // Tweet — maps themed (goes in the Maps & Geography room)
    const mapsTweet = await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/corameridian/status/1901000000000000001",
        title: "Tweet by @corameridian",
        description: "Every map is out of date the moment it's printed.",
        tags: ["maps", "cartography", "design"],
        externalLinks: [
          {
            url: "https://x.com/corameridian/status/1901000000000000001",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "1901000000000000001",
            authorName: "Cora Meridian",
            authorUsername: "corameridian",
            authorAvatarUrl:
              "https://api.dicebear.com/9.x/glass/svg?seed=corameridian",
            text: "Every map is out of date the moment it's printed.",
            postedAt: new Date("2026-03-28T05:46:47.000Z"),
            media: Prisma.JsonNull,
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Tweet — text only
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/jonahpierce/status/1901000000000000002",
        title: "Tweet by @jonahpierce",
        description:
          "Found a reading nook on the top floor of the library today — the one with the window that looks out over the whole valley — and stayed far longer than I meant to. There's something about a room designed for exactly one thing (sitting, reading, being quiet) that makes the rest of the day feel negotiable. No notifications, no small talk, just the specific weight of a book and the specific light of late afternoon. I keep saving links to 'focus systems' and 'productivity stacks', but the only system that has ever actually worked for me is finding a corner nobody else has claimed and refusing to leave until I've finished a chapter. New favourite place to disappear.",
        tags: ["reading", "libraries", "quiet"],
        externalLinks: [
          {
            url: "https://x.com/jonahpierce/status/1901000000000000002",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "1901000000000000002",
            authorName: "Jonah Pierce",
            authorUsername: "jonahpierce",
            authorAvatarUrl:
              "https://api.dicebear.com/9.x/glass/svg?seed=jonahpierce",
            text: "Found a reading nook on the top floor of the library today — the one with the window that looks out over the whole valley — and stayed far longer than I meant to. There's something about a room designed for exactly one thing (sitting, reading, being quiet) that makes the rest of the day feel negotiable. No notifications, no small talk, just the specific weight of a book and the specific light of late afternoon. I keep saving links to 'focus systems' and 'productivity stacks', but the only system that has ever actually worked for me is finding a corner nobody else has claimed and refusing to leave until I've finished a chapter. New favourite place to disappear.",
            postedAt: new Date("2026-03-06T16:30:23.000Z"),
            media: Prisma.JsonNull,
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Tweet — text only
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/nadiabuilds/status/1901000000000000003",
        title: "Tweet by @nadiabuilds",
        description:
          "Most startup advice ages badly because it's survivor pattern-matching dressed up as a law. What worked for one founder, in one market, at one moment gets frozen into a rule and repeated for a decade — until everyone forgets it was mostly luck wearing a nice jacket. Read widely, copy no one.",
        tags: ["startups", "reading"],
        externalLinks: [
          {
            url: "https://x.com/nadiabuilds/status/1901000000000000003",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "1901000000000000003",
            authorName: "Nadia Okafor",
            authorUsername: "nadiabuilds",
            authorAvatarUrl:
              "https://api.dicebear.com/9.x/glass/svg?seed=nadiabuilds",
            text: "Most startup advice ages badly because it's survivor pattern-matching dressed up as a law. What worked for one founder, in one market, at one moment gets frozen into a rule and repeated for a decade — until everyone forgets it was mostly luck wearing a nice jacket. Read widely, copy no one.",
            postedAt: new Date("2026-03-19T01:40:52.000Z"),
            media: Prisma.JsonNull,
            quotedTweetId: null,
            card: Prisma.JsonNull,
          },
        },
      },
    });

    // Tweet — text only
    await prisma.item.create({
      data: {
        userId,
        kind: "twitter",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://x.com/theomarsh/status/1901000000000000004",
        title: "Tweet by @theomarsh",
        description:
          "Every great product started as something people said would never work.",
        tags: ["startups", "ideas"],
        externalLinks: [
          {
            url: "https://x.com/theomarsh/status/1901000000000000004",
            platform: "twitter",
          },
        ],
        twitterDetails: {
          create: {
            tweetId: "1901000000000000004",
            authorName: "Theo Marsh",
            authorUsername: "theomarsh",
            authorAvatarUrl:
              "https://api.dicebear.com/9.x/glass/svg?seed=theomarsh",
            text: "Every great product started as something people said would never work.",
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
        sourceUrl: "https://x.com/annaquill/status/1901000000000000005",
        title: "Twitter Article",
        description: "Twitter Article (content not available for preview)",
        tags: ["history", "article"],
        meta: {
          twitterArticleId: "1901000000000000005",
          originalUrl: "https://x.com/annaquill/status/1901000000000000005",
        },
        externalLinks: [
          {
            url: "https://x.com/annaquill/status/1901000000000000005",
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
            duration: 1560,
            embedUrl: "https://www.youtube-nocookie.com/embed/4iQmPv_dTI0",
            thumbnailUrl: "https://i.ytimg.com/vi/4iQmPv_dTI0/hqdefault.jpg",
          },
        },
      },
    });

    // Vimeo video
    const vimeoItem = await prisma.item.create({
      data: {
        userId,
        kind: "video",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl: "https://vimeo.com/125896742",
        title: "Danny Macaskill: The Ridge",
        tags: ["cycling", "scotland", "film", "adventure"],
        meta: { originalName: "Danny Macaskill: The Ridge" },
        externalLinks: [
          { url: "https://vimeo.com/125896742", platform: "vimeo" },
        ],
        videoDetails: {
          create: {
            platform: "vimeo",
            videoId: "125896742",
            channelName: "Cut Media",
            channelUrl: "https://vimeo.com/cutmedia1",
            duration: 406,
            embedUrl: "https://player.vimeo.com/video/125896742",
            thumbnailUrl:
              "https://i.vimeocdn.com/video/516157704-4817e615cb3e9d8c251f94a2f5366aaec2049bbe62255bd6a04eadb01d72ab24-d_295x166?region=us",
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

    // --- BOOK ITEMS ---

    const mobyBook = await prisma.item.create({
      data: {
        userId,
        kind: "book",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl:
          "https://standardebooks.org/ebooks/herman-melville/moby-dick",
        coverFileKey: mobyCoverUpload.fileKey,
        title: "Moby-Dick; or, The Whale",
        description:
          "Ishmael's account of Captain Ahab's obsessive hunt for the white whale that took his leg — a sprawling meditation on obsession, nature, and fate.",
        tags: ["fiction", "classic", "adventure", "book"],
        meta: {
          originalName: "Moby-Dick; or, The Whale",
          coverSize: mobyCoverUpload.size,
          // Actual dimensions of seed-assets/book-moby-dick.jpg
          coverWidth: 800,
          coverHeight: 1200,
        },
        externalLinks: [
          {
            url: "https://standardebooks.org/ebooks/herman-melville/moby-dick",
            platform: "web",
          },
        ],
        bookDetails: {
          create: {
            authors: ["Herman Melville"],
            publisher: "Harper & Brothers",
            publishedAt: new Date("1851-11-14"),
            isbn: null,
            pageCount: 635,
            domain: "standardebooks.org",
          },
        },
      },
    });

    const willowsBook = await prisma.item.create({
      data: {
        userId,
        kind: "book",
        processingStatus: "completed",
        sourceType: "url",
        sourceUrl:
          "https://standardebooks.org/ebooks/kenneth-grahame/the-wind-in-the-willows",
        coverFileKey: willowsCoverUpload.fileKey,
        title: "The Wind in the Willows",
        description:
          "Mole, Rat, Toad, and Badger idle and adventure along the riverbank in Kenneth Grahame's gentle classic of English childhood.",
        tags: ["fiction", "classic", "children", "book"],
        meta: {
          originalName: "The Wind in the Willows",
          coverSize: willowsCoverUpload.size,
          // Actual dimensions of seed-assets/book-wind-in-the-willows.jpg
          coverWidth: 800,
          coverHeight: 1200,
        },
        externalLinks: [
          {
            url: "https://standardebooks.org/ebooks/kenneth-grahame/the-wind-in-the-willows",
            platform: "web",
          },
        ],
        bookDetails: {
          create: {
            authors: ["Kenneth Grahame"],
            publisher: "Methuen",
            publishedAt: new Date("1908-10-08"),
            isbn: null,
            pageCount: 240,
            domain: "standardebooks.org",
          },
        },
      },
    });

    // --- NOTE ITEMS ---

    // Note with a title and a markdown body
    await prisma.item.create({
      data: {
        userId,
        kind: "note",
        processingStatus: "completed",
        sourceType: "compose",
        title: "Reading list",
        noteDetails: {
          create: {
            content: [
              "Books to get through this quarter:",
              "",
              "- *The Timeless Way of Building* — Christopher Alexander",
              "- *Seeing Like a State* — James C. Scott",
              "- *The Beginning of Infinity* — David Deutsch",
              "",
              "Start with the Alexander — everyone keeps referencing it.",
            ].join("\n"),
          },
        },
      },
    });

    // Untitled note — body only
    await prisma.item.create({
      data: {
        userId,
        kind: "note",
        processingStatus: "completed",
        sourceType: "compose",
        title: null,
        noteDetails: {
          create: {
            content:
              "Idea: a room that auto-collects everything tagged maps. I keep saving them anyway.",
          },
        },
      },
    });

    // --- USER STATS ---

    const totalItems = 17;
    const totalStorage =
      BigInt(redArchUpload.size) +
      BigInt(atriumUpload.size) +
      BigInt(sunsetUpload.size) +
      BigInt(gifUpload.size) +
      BigInt(mobyCoverUpload.size) +
      BigInt(willowsCoverUpload.size);

    await prisma.user.update({
      where: { id: userId },
      data: {
        itemCount: totalItems,
        storageUsedBytes: totalStorage,
      },
    });

    // --- ROOMS ---

    const photographyRoom = await prisma.room.create({
      data: {
        userId,
        name: "Photography",
        slug: "photography",
        emoji: "📷",
        type: "manual",
        visibility: "private",
        roomItems: {
          create: [
            { itemId: redArchItem.id },
            { itemId: atriumItem.id },
            { itemId: sunsetItem.id },
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
          create: [{ itemId: mapsTweet.id }],
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

    const videosRoom = await prisma.room.create({
      data: {
        userId,
        name: "All Videos",
        slug: "all-videos",
        emoji: "📺",
        type: "manual",
        visibility: "private",
        roomItems: {
          create: [{ itemId: youtubeItem.id }, { itemId: vimeoItem.id }],
        },
      },
    });

    const bookshelfRoom = await prisma.room.create({
      data: {
        userId,
        name: "Bookshelf",
        slug: "bookshelf",
        emoji: "📚",
        type: "manual",
        visibility: "private",
        roomItems: {
          create: [{ itemId: mobyBook.id }, { itemId: willowsBook.id }],
        },
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
    console.log(
      `  Items: ${totalItems} (4 images, 2 articles, 4 tweets, 2 videos, 1 product, 2 books, 2 notes)`,
    );
    console.log(
      `  Rooms: ${photographyRoom.name}, ${mapsRoom.name}, ${musicRoom.name}, ${videosRoom.name}, ${bookshelfRoom.name}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
