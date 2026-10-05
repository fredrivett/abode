import { cn } from "@/lib/utils";
import type { TweetPoll as TweetPollData } from "./types";

// Fixed locale so the server and browser render the same digits (hydration)
const votesFormat = new Intl.NumberFormat("en-US");

function percentOf(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

/**
 * A tweet's poll: each option's share of the vote as a bar, the leading option
 * emphasised. Counts are what X reported when the tweet was saved — final once
 * the poll has closed.
 */
export function TweetPoll({ poll }: { poll: TweetPollData }) {
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
  const leadingVotes = Math.max(...poll.options.map((option) => option.votes));

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {poll.options.map((option, index) => {
          const percent = percentOf(option.votes, total);
          const isLeader = total > 0 && option.votes === leadingVotes;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat; static, never-reordered list
              key={index}
              className="relative overflow-hidden rounded-md"
            >
              <div
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 rounded-md",
                  isLeader
                    ? "bg-sky-200 dark:bg-sky-900"
                    : "bg-gray-100 dark:bg-gray-800",
                )}
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 text-gray-900 dark:text-gray-100">
                <span className={cn(isLeader && "font-semibold")}>
                  {option.label}
                </span>
                <span
                  className={cn("tabular-nums", isLeader && "font-semibold")}
                >
                  {percent}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-gray-500 text-sm dark:text-gray-400">
        {votesFormat.format(total)} {total === 1 ? "vote" : "votes"} ·{" "}
        {poll.isFinal ? "Final results" : "Results when saved"}
      </p>
    </div>
  );
}
