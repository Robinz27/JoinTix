"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Alert02Icon, Camera01Icon, CameraOff01Icon, CameraRotated01Icon, Loading03Icon, QrCode01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";

// Reads a ticket's QR with the camera (back by default, front at a tap of สลับกล้อง), or takes the code under it typed
// in, for the top-up desk and the shop tills. jsQR, as at the door, so it runs on any phone. The camera needs https
// or localhost. useCamera (below) is the camera for the door's scanner too.

/**
 * Whether to show this camera like a mirror: a webcam or front camera, where an unflipped picture moves the
 * wrong way as you line the QR up. A phone's back camera says "environment" and stays as it is. Only the
 * picture on screen flips; jsQR reads the video's own frames, so it never sees a mirrored code.
 */
function shouldMirror(media: MediaStream) {
  return media.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
}

/** How long a code must be out of sight before reading it again counts as a new scan */
const REPEAT_MS = 2500;

/**
 * Tells a new scan from the same code still held up to the camera. Without it, a refused ticket would be read
 * again the moment the refusal shows, over and over, and a ticket just finished with would come straight back.
 */
export function useRepeatGuard() {
  const last = useRef({ value: "", at: 0 });
  return useCallback((value: string) => {
    const now = Date.now();
    const fresh = value !== last.current.value || now - last.current.at > REPEAT_MS;
    last.current = { value, at: now };
    return fresh;
  }, []);
}

/** A green flash and tick over the camera the moment a QR is read. Add 1 to `flash` to play it again */
export function ScanFlash({ flash }: { flash: number }) {
  if (flash === 0) return null;
  return (
    <span key={flash} aria-hidden="true" className="scan-flash pointer-events-none absolute inset-0 grid place-items-center bg-emerald-500/25 ring-8 ring-emerald-500 ring-inset">
      <span className="scan-flash-badge grid size-20 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
        <Icon icon={Tick02Icon} className="size-11" />
      </span>
    </span>
  );
}

/** Which way the camera looks: "environment" is a phone's back camera, "user" the front one (or a laptop's webcam) */
export type Facing = "environment" | "user";

const FACING_KEY = "jointix-camera-facing";

function savedFacing(): Facing {
  try {
    return localStorage.getItem(FACING_KEY) === "user" ? "user" : "environment";
  } catch {
    return "environment";
  }
}

/**
 * The camera for every scanner (QrReader below, and the door's TicketScanner): start, stop, and สลับกล้อง between
 * front and back. A phone switches by facing; a computer with two cameras (no facing reported) steps to the next one.
 * The side chosen is remembered on this device, so a kiosk's front camera stays the front camera tomorrow.
 */
export function useCamera(messages: { unsupported: string; denied: string }) {
  /** Put on the <video> the picture shows in */
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [mirrored, setMirrored] = useState(false);
  const [error, setError] = useState<string>();
  const [canSwitch, setCanSwitch] = useState(false);
  const facing = useRef<Facing>("environment");

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setCamera("off");
  }, [release]);

  /** Opens a camera: by facing, or a particular device when the facing can't tell cameras apart */
  const open = useCallback(
    async (want: { facing: Facing } | { deviceId: string }) => {
      setError(undefined);
      if (!navigator.mediaDevices?.getUserMedia) return setError(messages.unsupported);
      setCamera("starting");
      release();
      try {
        const constraints = "deviceId" in want ? { deviceId: { exact: want.deviceId } } : { facingMode: { ideal: want.facing } };
        const media = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        stream.current = media;
        const settings = media.getVideoTracks()[0]?.getSettings();
        if (settings?.facingMode === "user" || settings?.facingMode === "environment") facing.current = settings.facingMode;
        setMirrored(shouldMirror(media));
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        setCamera("on");
        // Device names (and so how many there are) only show once permission is given
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        setCanSwitch(cameras.length > 1);
      } catch {
        setCamera("off");
        setError(messages.denied);
      }
    },
    [release, messages.unsupported, messages.denied],
  );

  const start = useCallback(() => {
    facing.current = savedFacing();
    return open({ facing: facing.current });
  }, [open]);

  /** สลับกล้อง: the other side on a phone, the next camera on a computer */
  const flip = useCallback(async () => {
    const track = stream.current?.getVideoTracks()[0];
    const settings = track?.getSettings();
    if (settings?.facingMode === "user" || settings?.facingMode === "environment") {
      const next: Facing = settings.facingMode === "environment" ? "user" : "environment";
      try {
        localStorage.setItem(FACING_KEY, next);
      } catch {
        // private mode: just not remembered
      }
      return open({ facing: next });
    }
    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    if (cameras.length < 2) return;
    const at = cameras.findIndex((d) => d.deviceId === settings?.deviceId);
    return open({ deviceId: cameras[(at + 1) % cameras.length].deviceId });
  }, [open]);

  // Off when leaving the page
  useEffect(() => release, [release]);

  return { video, camera, mirrored, error, setError, canSwitch, start, stop, flip };
}

/** The สลับกล้อง button over the picture, top right */
export function FlipCameraButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="สลับกล้องหน้า / หลัง"
      title="สลับกล้องหน้า / หลัง"
      className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-50"
    >
      <Icon icon={CameraRotated01Icon} className="size-5" />
    </button>
  );
}

const READER_MESSAGES = {
  unsupported: "เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเปิดเว็บผ่าน https) พิมพ์รหัสบัตรแทน",
  denied: "ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องในเบราว์เซอร์ หรือพิมพ์รหัสบัตรแทน",
};

export function QrReader({ onScan, paused, prompt }: { onScan: (value: string) => void; /** Stops reading while a result is on screen */ paused: boolean; prompt: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { video, camera, mirrored, error: cameraError, canSwitch, start, stop, flip } = useCamera(READER_MESSAGES);
  const [flash, setFlash] = useState(0);
  const isNew = useRepeatGuard();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (camera !== "on" || paused) return;
    let frame = 0;
    const read = () => {
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState >= 2) {
        // A smaller copy is plenty for a QR and keeps an old phone quick
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const found = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
          if (found?.data && isNew(found.data)) {
            navigator.vibrate?.(60);
            setFlash((n) => n + 1);
            onScan(found.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [camera, paused, onScan, isNew, video]);

  return (
    <>
      <div className="relative aspect-[4/3] w-full bg-black">
        <video ref={video} muted playsInline className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""} ${camera === "on" ? "" : "hidden"}`} />
        <canvas ref={canvas} className="hidden" />
        {camera === "on" && <ScanFlash flash={flash} />}
        {camera === "on" && canSwitch && <FlipCameraButton onClick={flip} />}
        {camera === "on" ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="size-3/5 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </span>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
            <Icon icon={QrCode01Icon} className="size-10" />
            <p className="text-sm">{prompt}</p>
            <button type="button" onClick={start} disabled={camera === "starting"} className={`${pillPrimary} h-10 px-5`}>
              <Icon icon={camera === "starting" ? Loading03Icon : Camera01Icon} className={`size-4 ${camera === "starting" ? "animate-spin" : ""}`} />
              {camera === "starting" ? "กำลังเปิดกล้อง…" : "เปิดกล้องสแกน"}
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        {cameraError && (
          <p className="flex gap-1.5 text-xs text-red-600 dark:text-red-400">
            <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
            {cameraError}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onScan(typed.trim());
            setTyped("");
          }}
          className="flex gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder="หรือพิมพ์รหัสบัตร เช่น 7KQ3-M9XA"
              aria-label="รหัสบัตร"
              autoComplete="off"
              spellCheck={false}
              className={`${input} pl-9 font-mono tracking-wider`}
            />
          </div>
          <button type="submit" disabled={!typed.trim()} className={`${pill} h-10`}>
            ค้นหา
          </button>
        </form>
        {camera === "on" && (
          <button type="button" onClick={stop} className={`${pill} h-10 w-full justify-center`}>
            <Icon icon={CameraOff01Icon} className="size-4" />
            ปิดกล้อง
          </button>
        )}
      </div>
    </>
  );
}
