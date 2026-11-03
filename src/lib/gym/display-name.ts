// Public, privacy-safe leaderboard name derived from a member's full name: first name plus the
// initial of their last word (e.g. "Ramesh K."). Never includes any part of the Employee ID.

const isInitial = (token: string) => token.endsWith(".") || token.replace(/\./g, "").length === 1;

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export function deriveDisplayName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "Member";

  const firstIndex = tokens.findIndex((t) => !isInitial(t));
  if (firstIndex === -1) return titleCase(tokens[0].replace(/\./g, "")) || "Member";

  const first = titleCase(tokens[firstIndex]);
  const rest = tokens.slice(firstIndex + 1);
  if (rest.length === 0) return first;
  return `${first} ${rest[rest.length - 1].charAt(0).toUpperCase()}.`;
}
