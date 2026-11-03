import { describe, it, expect } from "vitest";
import { deriveDisplayName } from "./display-name";

describe("deriveDisplayName", () => {
  it("uses first name plus last-name initial", () => {
    expect(deriveDisplayName("ramesh kumar")).toBe("Ramesh K.");
    expect(deriveDisplayName("RAMESH KUMAR SHARMA")).toBe("Ramesh S.");
  });
  it("skips leading initials", () => {
    expect(deriveDisplayName("K. Ramesh")).toBe("Ramesh");
    expect(deriveDisplayName("K Ramesh")).toBe("Ramesh");
  });
  it("uses a trailing initial as the last-name initial", () => {
    expect(deriveDisplayName("Ramesh K")).toBe("Ramesh K.");
  });
  it("keeps two-letter first names", () => {
    expect(deriveDisplayName("Om Prakash")).toBe("Om P.");
  });
  it("returns a single name unchanged apart from casing", () => {
    expect(deriveDisplayName("Ramesh")).toBe("Ramesh");
  });
  it("falls back to Member for blank names", () => {
    expect(deriveDisplayName("  ")).toBe("Member");
  });
  it("uses the first token without dots when every token is an initial", () => {
    expect(deriveDisplayName("A. B.")).toBe("A");
  });
});
