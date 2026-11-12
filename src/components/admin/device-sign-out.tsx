"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loading03Icon, Logout03Icon } from "@hugeicons/core-free-icons";
import { signOutMember } from "@/app/actions/admin";
import { pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

// ออกจากระบบ, right on a device in a member's อุปกรณ์ tab (or every device at once). The first press asks again, in
// the same place, so a slip of the finger signs nobody out; it settles back after a few seconds.

export function DeviceSignOut({ userId, sessionId, all = false, disabled }: { userId: string; sessionId?: string; all?: boolean; disabled?: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!sure) return;
    const timer = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(timer);
  }, [sure]);

  const press = () => {
    if (!sure) return setSure(true);
    start(async () => {
      await signOutMember(userId, sessionId);
      setSure(false);
      router.refresh();
    });
  };

  return (
    <Hint label={disabled}>
      <button
        type="button"
        disabled={Boolean(disabled) || pending}
        onClick={press}
        className={`${pill} h-8 px-3 text-xs ${sure ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400" : ""}`}
      >
        <Icon icon={pending ? Loading03Icon : Logout03Icon} className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
        {sure ? "กดอีกครั้งเพื่อยืนยัน" : all ? "ออกจากระบบทุกเครื่อง" : "ออกจากระบบ"}
      </button>
    </Hint>
  );
}
