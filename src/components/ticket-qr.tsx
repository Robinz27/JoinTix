"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Cancel01Icon, QrCodeIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";

// แสดง QR on a ticket (app/(site)/tickets): opens big and bright on a white card so the door's camera
// reads it at any screen brightness. The QR is drawn in the browser from the ticket's secret, which
// never leaves this account's own page.

export function TicketQrButton({
  secret,
  code,
  title,
  label,
  used,
}: {
  secret: string;
  code: string;
  title: string;
  /** "VIP · ใบที่ 1 จาก 2" */
  label: string;
  /** Scanned in already: the QR still shows, marked as used */
  used: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
          used ? "border border-border text-muted-foreground hover:bg-secondary" : "bg-primary text-primary-foreground hover:bg-primary-hover"
        }`}
      >
        <Icon icon={QrCodeIcon} className="size-4" />
        แสดง QR
      </button>
      {open && <QrDialog secret={secret} code={code} title={title} label={label} used={used} onClose={() => setOpen(false)} />}
    </>
  );
}

function QrDialog({ secret, code, title, label, used, onClose }: { secret: string; code: string; title: string; label: string; used: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    let live = true;
    QRCode.toString(secret, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(
      (out) => live && setSvg(out),
    );
    return () => {
      live = false;
    };
  }, [secret]);

  return (
    <dialog
      ref={dialog}
      aria-label={`QR บัตร ${title}`}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      style={{ width: "min(100% - 1.5rem, 22rem)" }}
      className="dialog-pop m-auto rounded-3xl border-0 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/80"
    >
      <div className="relative px-6 pt-6 pb-5 text-center">
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="ปิด"
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          <Icon icon={Cancel01Icon} className="size-5" />
        </button>
        <p className="pr-8 text-left text-sm font-semibold text-balance">{title}</p>
        <p className="text-left text-xs text-neutral-500">{label}</p>

        <div className="relative mx-auto mt-4 aspect-square w-full max-w-64">
          {svg ? (
            // Our own SVG from the qrcode package, made from the ticket's secret only
            <div className={`size-full [&>svg]:size-full ${used ? "opacity-25" : ""}`} dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="skeleton block size-full rounded-xl" />
          )}
          {used && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
                <Icon icon={Tick02Icon} className="size-4" />
                ใช้เข้างานแล้ว
              </span>
            </span>
          )}
        </div>

        <p className="mt-3 font-mono text-xl font-bold tracking-[0.2em]">{code}</p>
        <p className="mt-2 text-2xs text-neutral-500">{used ? "บัตรใบนี้ถูกสแกนเข้างานแล้ว ใช้ซ้ำไม่ได้" : "ยื่นให้เจ้าหน้าที่สแกนที่ทางเข้า เพิ่มความสว่างหน้าจอถ้าสแกนไม่ติด"}</p>
      </div>
    </dialog>
  );
}
