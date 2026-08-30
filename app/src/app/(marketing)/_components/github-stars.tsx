import { Github, Star } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { formatStarCount, GITHUB_URL, getGitHubStars } from "@/lib/github";
import { cn } from "@/lib/utils";

type StarButtonProps = {
  count: number | null;
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
};

export function StarButton({ count, size = "sm", className }: StarButtonProps) {
  return (
    <Button
      asChild
      variant="outline"
      size={size}
      className={cn("gap-1.5", className)}
    >
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">
        <Github className="size-4" aria-hidden />
        star on github
        {count !== null && (
          <span className="ml-0.5 inline-flex items-center gap-0.5 text-muted-foreground">
            <Star className="size-3 fill-current" aria-hidden />
            {formatStarCount(count)}
          </span>
        )}
      </a>
    </Button>
  );
}

export async function GitHubStars(props: Omit<StarButtonProps, "count">) {
  const count = await getGitHubStars();
  return <StarButton count={count} {...props} />;
}
