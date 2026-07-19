import { Github, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatStarCount, GITHUB_URL, getGitHubStars } from "@/lib/github";

export function StarButton({ count }: { count: number | null }) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
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

export async function GitHubStars() {
  const count = await getGitHubStars();
  return <StarButton count={count} />;
}
