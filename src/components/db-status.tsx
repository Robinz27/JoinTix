import { connection } from "next/server";
import { Hint } from "@/components/ui/hint";
import { checkConnection } from "@/db";

/** Small dot showing whether the database is reachable: green (with a soft pulse) or red. */
export async function DbStatusDot() {
  await connection();
  const { ok, error } = await checkConnection();

  return (
    <Hint label={ok ? "ระบบพร้อมใช้งาน" : `เชื่อมต่อฐานข้อมูลไม่ได้${error ? `: ${error}` : ""}`}>
      <span className="relative flex size-2 shrink-0">
        {ok && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
        <span className={`relative size-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-500"}`} />
        <span className="sr-only">{ok ? "ระบบพร้อมใช้งาน" : "ระบบขัดข้อง เชื่อมต่อฐานข้อมูลไม่ได้"}</span>
      </span>
    </Hint>
  );
}

/** Shown while DbStatusDot waits for the database */
export function DbStatusDotFallback() {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
      <span className="sr-only">กำลังตรวจสอบสถานะระบบ</span>
    </span>
  );
}
