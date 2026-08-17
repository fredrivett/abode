// "1 person" / "2 people"
export function formatInvitedCount(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}
