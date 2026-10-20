type BookAuthorsProps = {
  authors: string[];
  className?: string;
};

/** "by Walter Isaacson": a book's authors, with an italic "by". */
export function BookAuthors({ authors, className }: BookAuthorsProps) {
  if (authors.length === 0) return null;
  return (
    <span className={className}>
      <em>by</em> {authors.join(", ")}
    </span>
  );
}
