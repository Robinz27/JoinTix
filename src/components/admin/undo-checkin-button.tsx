"use client";

import { useState, useTransition } from "react";
import { Loading03Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { undoAdmit } from "@/app/actions/orders";
import { iconButton } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

/** ยกเลิกการเช็กอิน on a row of the check-in list, asking once more before it does */
export function UndoCheckinButton({ ticketId, holder }: { ticketId: string; holder: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (asking)
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await undoAdmit(ticketId)))}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending && <Icon icon={Loading03Icon} className="size-3.5 animate-spin" />}
          ยืนยันยกเลิก
        </button>
        <button type="button" onClick={() => setAsking(false)} className="h-8 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground">
          ไม่
        </button>
      </span>
    );
  return (
    <Hint label="ยกเลิกการเช็กอิน">
      <button type="button" onClick={() => setAsking(true)} aria-label={`ยกเลิกการเช็กอินของ ${holder}`} className={iconButton}>
        <Icon icon={Undo02Icon} className="size-4" />
      </button>
    </Hint>
  );
}
