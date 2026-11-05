import { Badge } from "@/components/admin/ui";
import type { ScanOutcome } from "@/lib/checkins";

// How a scan_logs result reads, in the scanner's latest scans and the check-in page's log

const LABEL: Record<ScanOutcome, { label: string; tone: "muted" | "good" | "warn" | "strong" }> = {
  admitted: { label: "ให้เข้างาน", tone: "good" },
  valid: { label: "ตรวจแล้ว", tone: "muted" },
  used: { label: "สแกนซ้ำ", tone: "warn" },
  wrong_event: { label: "ผิดงาน", tone: "strong" },
  not_found: { label: "ไม่พบบัตร", tone: "strong" },
  void: { label: "บัตรยกเลิก", tone: "strong" },
  undone: { label: "ยกเลิกเช็กอิน", tone: "warn" },
};

export function ScanBadge({ result }: { result: ScanOutcome }) {
  const { label, tone } = LABEL[result] ?? LABEL.valid;
  return <Badge tone={tone}>{label}</Badge>;
}
