import { useEffect, useState } from "react";
import { hashEmployeeId } from "@/lib/hall/crypto";

/** The logged-in member's employee-ID hash (null while computing or when logged out). */
export function useMemberHash(empId: string | null): string | null {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setHash(null);
    if (empId) void hashEmployeeId(empId).then((h) => !cancelled && setHash(h));
    return () => {
      cancelled = true;
    };
  }, [empId]);
  return hash;
}
