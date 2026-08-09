import type { InstagramMedia } from "@/lib/types/item";

/** The still image to re-host for a media item: the photo, or a video poster. */
function mediaStillUrl(item: InstagramMedia): string | null {
  return item.type === "photo" ? item.url : (item.posterUrl ?? null);
}

/** Downloads an image and returns its re-hosted key + size, or null on failure. */
type Downloader = (
  url: string,
) => Promise<{ fileKey: string; size: number } | null>;

export type RehostInstagramResult = {
  /** Media with re-hosted `fileKey`s filled in where the download succeeded. */
  media: InstagramMedia[];
  /** Re-hosted key of the cover image (grid preview), for item.coverFileKey. */
  coverFileKey: string | null;
  /** Byte size of the cover image, for meta.coverSize accounting. */
  coverSize: number;
  /** Every key stored this run, so the caller can keep them on cleanup. */
  storedFileKeys: string[];
};

/**
 * Re-host an Instagram post's media stills (each photo, or a video's poster)
 * into our storage so the saved post survives cdninstagram URL expiry / post
 * deletion. Each download is best-effort: a failure leaves that item pointing at
 * its original cdninstagram URL.
 *
 * Only the cover counts toward `coverSize` (mirrors products/tweets); the other
 * stored keys are tracked so reanalysis can reclaim them. The cover is the
 * chosen index's re-hosted still, else the first that hosted — so `coverFileKey`
 * is null iff nothing hosted. Exported with an injectable downloader for testing.
 */
export async function rehostInstagramMedia(
  media: InstagramMedia[],
  coverMediaIndex: number,
  download: Downloader,
): Promise<RehostInstagramResult> {
  const sizeByKey = new Map<string, number>();

  const rehosted = await Promise.all(
    media.map(async (item): Promise<InstagramMedia> => {
      const stillUrl = mediaStillUrl(item);
      if (!stillUrl) return item;
      const stored = await download(stillUrl);
      if (!stored) return item;
      sizeByKey.set(stored.fileKey, stored.size);
      return { ...item, fileKey: stored.fileKey };
    }),
  );

  const firstHostedKey = rehosted.find((m) => m.fileKey)?.fileKey;
  const coverFileKey =
    rehosted[coverMediaIndex]?.fileKey ?? firstHostedKey ?? null;

  return {
    media: rehosted,
    coverFileKey,
    coverSize: coverFileKey ? (sizeByKey.get(coverFileKey) ?? 0) : 0,
    storedFileKeys: [...sizeByKey.keys()],
  };
}
