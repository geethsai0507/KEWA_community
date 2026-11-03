import { generateDeviceId } from "@/lib/hall/crypto";

export const GYM_DEVICE_ID_KEY = "gym_device_id";

export function getOrCreateDeviceId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storage.getItem(GYM_DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateDeviceId();
  storage.setItem(GYM_DEVICE_ID_KEY, id);
  return id;
}

export type DeviceLinkState = "ok" | "mismatch" | "unlinked";

/** linkedDeviceId is the member's stored gym phone (null if they have never scanned). */
export function deviceLinkState(linkedDeviceId: string | null, deviceId: string): DeviceLinkState {
  if (linkedDeviceId === null) return "unlinked";
  return linkedDeviceId === deviceId ? "ok" : "mismatch";
}
