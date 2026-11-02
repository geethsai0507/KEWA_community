import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { hashEmployeeId } from "@/lib/hall/crypto";
import {
  deleteVisit,
  fetchMonthVisits,
  getMemberDisplayName,
  resetDeviceLink,
} from "@/lib/gym/store";
import {
  formatIstTime,
  formatMinutes,
  istDayKey,
  istMonthKey,
  istMonthRange,
} from "@/lib/gym/time";
import { effectiveStatus, visitMinutes, type GymVisit } from "@/lib/gym/visits";

const QR_CAPTION = "Scan to check in / out of the gym";

export function AdminGymTab() {
  return (
    <div className="space-y-s-lg">
      <DoorQr />
      <ResetPhoneLink />
      <VisitList />
    </div>
  );
}

function DoorQr() {
  const scanUrl = typeof window === "undefined" ? "" : `${window.location.origin}/gym/scan`;
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (scanUrl) void QRCode.toDataURL(scanUrl, { width: 600, margin: 2 }).then(setDataUrl);
  }, [scanUrl]);

  const print = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const d = w.document;
    d.title = "Gym QR";
    d.body.style.cssText = "font-family:sans-serif;text-align:center;padding:40px";
    const img = d.createElement("img");
    img.alt = "Gym QR code";
    img.style.cssText = "width:80%;max-width:600px";
    const caption = d.createElement("h1");
    caption.textContent = QR_CAPTION;
    d.body.append(img, caption);
    // Set the handler before src so a cached data URL can't load before it is attached.
    img.onload = () => w.print();
    img.src = dataUrl;
  };

  return (
    <section className="space-y-4">
      <h2 className="font-headline text-xl text-primary">Door QR code</h2>
      <p className="text-sm opacity-70">
        Print once and stick it on the gym door. It always opens {scanUrl || "/gym/scan"}.
      </p>
      {dataUrl && (
        <img
          src={dataUrl}
          alt="Gym QR code"
          className="w-48 h-48 border-2 border-primary bg-white"
        />
      )}
      <button
        onClick={print}
        disabled={!dataUrl}
        className="px-4 py-2 bg-primary text-on-primary font-ui-button"
      >
        Print
      </button>
    </section>
  );
}

function ResetPhoneLink() {
  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState("");

  const reset = async () => {
    const id = empId.trim();
    if (!id) return;
    setStatus("Resetting…");
    try {
      const hash = await hashEmployeeId(id);
      await resetDeviceLink(hash);
      setStatus(`Phone link reset for ${await getMemberDisplayName(hash)}.`);
      setEmpId("");
    } catch {
      setStatus("Something went wrong, try again.");
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="font-headline text-xl text-primary">Reset a member's gym phone</h2>
      <p className="text-sm opacity-70">
        Use when a member changes phones. Their next scan links the new phone.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          placeholder="Employee ID"
          className="p-2 border-2 border-primary bg-surface"
        />
        <button onClick={reset} className="px-4 py-2 border-2 border-primary font-ui-button">
          Reset phone link
        </button>
      </div>
      {status && <p className="text-sm">{status}</p>}
    </section>
  );
}

function VisitList() {
  const months = useMemo(() => {
    const current = istMonthKey(new Date());
    return [current, istMonthKey(new Date(istMonthRange(current).start.getTime() - 1))];
  }, []);
  const [month, setMonth] = useState(months[0]);
  const [visits, setVisits] = useState<GymVisit[] | null>(null);
  const [error, setError] = useState(false);

  const load = async (m: string) => {
    setVisits(null);
    setError(false);
    try {
      const list = await fetchMonthVisits(m);
      setVisits(list.sort((a, b) => b.inAt.getTime() - a.inAt.getTime()));
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load(month);
  }, [month]);

  const remove = async (v: GymVisit) => {
    if (!window.confirm(`Delete ${v.displayName}'s visit on ${istDayKey(v.inAt)}?`)) return;
    await deleteVisit(v.id);
    void load(month);
  };

  const now = new Date();
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="font-headline text-xl text-primary">Visits</h2>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border-2 border-primary bg-surface px-2 py-1"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-error">Something went wrong, try again.</p>}
      {!visits && !error && <p className="opacity-70">Loading…</p>}
      {visits && visits.length === 0 && <p className="opacity-70">No visits this month.</p>}
      {visits && visits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-primary">
                <th className="py-2 pr-2">Member</th>
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">In</th>
                <th className="py-2 pr-2">Out</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Minutes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-outline-variant">
                  <td className="py-2 pr-2">{v.displayName}</td>
                  <td className="py-2 pr-2">{istDayKey(v.inAt)}</td>
                  <td className="py-2 pr-2">{formatIstTime(v.inAt)}</td>
                  <td className="py-2 pr-2">{v.outAt ? formatIstTime(v.outAt) : "—"}</td>
                  <td className="py-2 pr-2">{effectiveStatus(v, now)}</td>
                  <td className="py-2 pr-2">{formatMinutes(visitMinutes(v, now))}</td>
                  <td className="py-2">
                    <button onClick={() => void remove(v)} className="text-error underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
