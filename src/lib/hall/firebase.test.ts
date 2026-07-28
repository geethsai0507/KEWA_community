import { describe, it, expect, vi } from "vitest";

vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key");
vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test.appspot.com");
vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");

describe("firebase init", () => {
  it("initializes db and auth without throwing", async () => {
    const { db, auth } = await import("./firebase");
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
  });
});
