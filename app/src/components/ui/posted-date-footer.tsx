import { DateTime } from "@/components/ui/date-time";
import { ViewOnButton } from "@/components/ui/view-on-button";

type PostedDateFooterProps = {
  /** When the post was published; the date is omitted when unknown */
  postedAt?: Date | string | number | null;
  /** External URL for the "View on {label}" button */
  viewOnHref: string;
  /** Destination name shown after "View on " (e.g. "X", "Instagram") */
  viewOnLabel: string;
};

/**
 * Footer row for a social-post detail view (Twitter, Instagram): the posted
 * date on the left — omitted when unknown, keeping the button right-aligned —
 * and a "View on {platform}" link on the right.
 */
export function PostedDateFooter({
  postedAt,
  viewOnHref,
  viewOnLabel,
}: PostedDateFooterProps) {
  return (
    <div className="flex items-center justify-between pt-4">
      {postedAt ? (
        <DateTime
          date={postedAt}
          className="text-gray-500 text-sm dark:text-gray-400"
        />
      ) : (
        <div />
      )}
      <ViewOnButton href={viewOnHref} label={viewOnLabel} />
    </div>
  );
}
