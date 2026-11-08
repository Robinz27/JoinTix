"use client";

import { useState, useTransition } from "react";
import { Alert02Icon, Cancel01Icon, CheckmarkCircle02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { approveSlip, rejectSlip } from "@/app/actions/payments";
import { AdminDialog } from "@/components/admin/dialog";
import { label } from "@/components/admin/form";
import { input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";

// The two buttons under a slip waiting in /admin/payments: อนุมัติ (pays the order, issues its tickets) and ปฏิเสธ
// (with a reason the buyer sees; then either another try for the buyer or the order cancelled).

const REASONS = ["ยอดโอนไม่ตรงกับยอดที่ต้องชำระ", "ไม่พบยอดโอนเข้าบัญชี", "สลิปไม่ชัด อ่านไม่ได้", "โอนเข้าบัญชีอื่น"];

export function SlipDecision({ paymentId, code, amount }: { paymentId: string; code: string; amount: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="flex gap-1.5 text-xs text-red-600 dark:text-red-400">
          <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            // Twice: the first press asks, the second pays
            if (!confirm) return setConfirm(true);
            start(async () => {
              setError(undefined);
              const result = await approveSlip(paymentId);
              if (result.error) setError(result.error);
              setConfirm(false);
            });
          }}
          className={`${pillPrimary} flex-1 justify-center whitespace-nowrap ${confirm ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}`}
        >
          <Icon icon={busy ? Loading03Icon : CheckmarkCircle02Icon} className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "กำลังออกบัตร…" : confirm ? `ยืนยัน ได้รับ ${amount} แล้ว` : "อนุมัติ"}
        </button>
        <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={`${pill} flex-1 justify-center whitespace-nowrap text-red-600 dark:text-red-400`}>
          <Icon icon={Cancel01Icon} className="size-4" />
          ปฏิเสธ
        </button>
      </div>
      {rejecting && <RejectDialog paymentId={paymentId} code={code} onClose={() => setRejecting(false)} />}
    </div>
  );
}

function RejectDialog({ paymentId, code, onClose }: { paymentId: string; code: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [then, setThen] = useState<"retry" | "cancel">("retry");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();

  return (
    <AdminDialog onClose={onClose} title="ปฏิเสธสลิป" subtitle={`คำสั่งซื้อ ${code}`} icon={Cancel01Icon} danger done={done}>
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(undefined);
            const result = await rejectSlip(paymentId, reason, then);
            if (result.error) setError(result.error);
            else setDone(true);
          });
        }}
      >
        <div>
          <label className={label} htmlFor="reject-reason">
            เหตุผล (ลูกค้าจะเห็นข้อความนี้)
          </label>
          <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className={`${input} h-auto py-2`} required />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-border px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                {r}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className={label}>หลังจากนี้</legend>
          {(
            [
              ["retry", "ให้ลูกค้าแนบสลิปใหม่", "บัตรยังล็อกไว้ให้อีก 15 นาที"],
              ["cancel", "ยกเลิกคำสั่งซื้อ", "บัตรและสินค้าคืนเข้าระบบทันที"],
            ] as const
          ).map(([value, title, detail]) => (
            <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${then === value ? "border-foreground" : "border-border"}`}>
              <input type="radio" name="then" className="mt-1" checked={then === value} onChange={() => setThen(value)} />
              <span>
                <span className="block font-medium text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className={`${pillPrimary} bg-red-600 text-white hover:bg-red-700`}>
            {busy && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
            ปฏิเสธสลิป
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
