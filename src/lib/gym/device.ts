import { generateDeviceId } from "@/lib/hall/crypto";

export const GYM_DEVICE_ID_KEY = "gym_device_id";

export function getOrCreateDeviceId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storage.getItem(GYM_DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateDeviceId();
  storage.setItem(GYM_DEVICE_ID_KEY, id);
  return id;
}
