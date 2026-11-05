"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  ComputerIcon,
  Delete02Icon,
  Loading03Icon,
  Logout03Icon,
  PencilEdit02Icon,
  SecurityCheckIcon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { deleteMember, memberSessions, signOutMember, updateMember, type MemberSession } from "@/app/actions/admin";
import { AdminDialog } from "@/components/admin/dialog";
import { Choices, Notice, label } from "@/components/admin/form";
import { iconButton, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

// แก้ไข / อุปกรณ์ / ลบ on each row of สมาชิก, the way next.js-shop's customer list does it: icon buttons that
// open a dialog. A dialog is mounted only while open, so the page doesn't carry a hidden form per member,
// and every opening starts with a clean form state.

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
};

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

function Actions({ pending, submitLabel, onCancel }: { pending: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" onClick={onCancel} className={pill}>
        ยกเลิก
      </button>
      <button type="submit" disabled={pending} className={pillPrimary}>
        {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}

function EditDialog({ member, self, onClose }: { member: Member; self: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateMember, {});
  const ids = useId();

  return (
    <AdminDialog onClose={onClose} done={Boolean(state.ok)} icon={PencilEdit02Icon} title={`แก้ไข ${member.name}`} subtitle={member.email}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="userId" value={member.id} />
        <Notice state={state} />

        <div>
          <label htmlFor={`${ids}-name`} className={label}>
            ชื่อ
          </label>
          <input id={`${ids}-name`} name="name" required maxLength={100} defaultValue={member.name} className={input} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${ids}-email`} className={label}>
              อีเมล
            </label>
            <input id={`${ids}-email`} name="email" type="email" required defaultValue={member.email} className={input} />
          </div>
          <div>
            <label htmlFor={`${ids}-phone`} className={label}>
              เบอร์โทร
            </label>
            <input id={`${ids}-phone`} name="phone" inputMode="tel" required pattern="0[0-9\s\-]{8,11}" defaultValue={member.phone} className={input} />
          </div>
        </div>

        <fieldset>
          <legend className={label}>การยืนยันอีเมล</legend>
          <Choices
            name="emailVerified"
            value={member.emailVerified ? "1" : "0"}
            options={[
              { value: "1", label: "ยืนยันแล้ว" },
              { value: "0", label: "ยังไม่ยืนยัน" },
            ]}
          />
          <p className="mt-1.5 text-2xs text-muted-foreground">ยืนยันแล้ว = ซื้อบัตรได้เลยโดยไม่ต้องกรอกรหัสยืนยัน</p>
        </fieldset>

        {self ? (
          <p className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-2xs text-muted-foreground">
            สิทธิ์: Super admin · เปลี่ยนสิทธิ์ของตัวเองไม่ได้ เพื่อไม่ให้หลังบ้านไม่เหลือใครเข้าได้
          </p>
        ) : (
          <fieldset>
            <legend className={label}>สิทธิ์</legend>
            <Choices
              name="role"
              value={member.role}
              options={[
                { value: "user", label: "สมาชิก" },
                { value: "super_admin", label: "Super admin" },
              ]}
            />
            <p className="mt-1.5 text-2xs text-muted-foreground">Super admin เข้าหลังบ้านและแก้ไขสมาชิกทุกคนได้</p>
          </fieldset>
        )}

        <div>
          <label htmlFor={`${ids}-password`} className={label}>
            ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)
          </label>
          <input
            id={`${ids}-password`}
            name="password"
            type="text"
            autoComplete="off"
            minLength={8}
            maxLength={128}
            placeholder="ไม่เปลี่ยน"
            className={input}
          />
          <p className="mt-1.5 text-2xs text-muted-foreground">ตั้งใหม่แล้วบัญชีนี้จะออกจากระบบทุกเครื่อง</p>
        </div>

        <p className="text-2xs text-muted-foreground">สมัครเมื่อ {when.format(new Date(member.createdAt))}</p>
        <Actions pending={pending} submitLabel="บันทึก" onCancel={onClose} />
      </form>
    </AdminDialog>
  );
}

/** Roughly what device a user agent is, enough to tell "my phone" from "a computer I don't know" */
function device(userAgent: string | null): { icon: IconSvgElement; name: string } {
  const ua = userAgent ?? "";
  const phone = /Android|iPhone|iPad|Mobile/i.test(ua);
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return { icon: phone ? SmartPhone01Icon : ComputerIcon, name: [browser, os].filter(Boolean).join(" บน ") || "อุปกรณ์ที่ไม่รู้จัก" };
}

function DevicesDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const [sessions, setSessions] = useState<MemberSession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let live = true;
    memberSessions(member.id)
      .then((rows) => live && setSessions(rows))
      .catch(() => live && setError("โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้ง"));
    return () => {
      live = false;
    };
  }, [member.id]);

  const run = (key: string, sessionId?: string) => {
    setBusy(key);
    setError(undefined);
    signOutMember(member.id, sessionId)
      .then(setSessions)
      .catch(() => setError("ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง"))
      .finally(() => {
        setBusy(null);
        setConfirmAll(false);
      });
  };
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <AdminDialog onClose={onClose} icon={SecurityCheckIcon} title={`อุปกรณ์ของ ${member.name}`} subtitle="เครื่องที่บัญชีนี้เข้าสู่ระบบไว้" width="38rem">
      <Notice state={{ error }} />
      {sessions === null ? (
        !error && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Icon icon={Loading03Icon} className="size-4 animate-spin" /> กำลังโหลด…
          </p>
        )
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-border px-3.5 py-3 text-sm text-muted-foreground">ตอนนี้ไม่ได้เข้าสู่ระบบไว้ที่เครื่องไหน</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {sessions.map((s) => {
            const d = device(s.userAgent);
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <Icon icon={d.icon} className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {d.name}
                    {s.current && <span className="text-muted-foreground"> (เครื่องนี้)</span>}
                  </p>
                  <p className="truncate text-2xs text-muted-foreground tabular-nums">
                    ใช้ล่าสุด {when.format(new Date(s.lastSeen))}
                    {s.ipAddress && ` · ${s.ipAddress}`}
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => run(s.id, s.id)}
                    disabled={busy !== null}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                  >
                    {busy === s.id && <Icon icon={Loading03Icon} className="size-3.5 animate-spin" />}
                    ออกจากระบบ
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {others.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {confirmAll && <span className="mr-auto text-xs text-red-500">ทุกเครื่องของ {member.name} จะหลุดทันที ยืนยัน?</span>}
          {confirmAll && (
            <button type="button" onClick={() => setConfirmAll(false)} disabled={busy !== null} className={pill}>
              ยกเลิก
            </button>
          )}
          <button
            type="button"
            onClick={() => (confirmAll ? run("all") : setConfirmAll(true))}
            disabled={busy !== null}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
          >
            <Icon icon={busy === "all" ? Loading03Icon : Logout03Icon} className={`size-4 ${busy === "all" ? "animate-spin" : ""}`} />
            {confirmAll ? "ยืนยัน ออกจากระบบทุกเครื่อง" : "ออกจากระบบทุกเครื่อง"}
          </button>
        </div>
      )}
    </AdminDialog>
  );
}

function DeleteDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteMember, {});
  const ids = useId();

  return (
    <AdminDialog onClose={onClose} done={Boolean(state.ok)} danger icon={Delete02Icon} title={`ลบ ${member.name}`} subtitle="ลบถาวร ย้อนกลับไม่ได้">
      <form action={action}>
        <input type="hidden" name="userId" value={member.id} />
        <Notice state={state} />
        <p className="mb-3 text-sm text-muted-foreground">
          บัญชี รหัสผ่าน และการเข้าสู่ระบบทุกเครื่องของบัญชีนี้จะถูกลบ เจ้าของต้องสมัครใหม่ถ้าจะกลับมาใช้
        </p>
        <label className={label} htmlFor={`${ids}-confirm`}>
          พิมพ์ <b className="break-all text-foreground">{member.email}</b> เพื่อยืนยัน
        </label>
        <input id={`${ids}-confirm`} name="confirm" autoComplete="off" required placeholder={member.email} className={input} />
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-70"
          >
            {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
            ลบถาวร
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

type Opened = "edit" | "devices" | "delete" | null;

export function MemberActions({ member, self }: { member: Member; self: boolean }) {
  const [opened, setOpened] = useState<Opened>(null);
  const close = () => setOpened(null);
  const danger = "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground";
  const buttons: { key: Exclude<Opened, null>; icon: IconSvgElement; label: string; disabled?: string; danger?: boolean }[] = [
    { key: "edit", icon: PencilEdit02Icon, label: "แก้ไข" },
    { key: "devices", icon: SecurityCheckIcon, label: "อุปกรณ์" },
    { key: "delete", icon: Delete02Icon, label: "ลบบัญชี", danger: true, disabled: self ? "ลบบัญชีของตัวเองไม่ได้" : undefined },
  ];

  return (
    <div className="flex items-center justify-end gap-1.5">
      {buttons.map((b) => (
        <Hint key={b.key} label={b.disabled ?? b.label}>
          <button
            type="button"
            disabled={Boolean(b.disabled)}
            onClick={() => setOpened(b.key)}
            aria-label={`${b.label} ${member.name}`}
            className={`${iconButton} ${b.danger ? danger : ""}`}
          >
            <Icon icon={b.icon} className="size-4" />
          </button>
        </Hint>
      ))}

      {opened === "edit" && <EditDialog member={member} self={self} onClose={close} />}
      {opened === "devices" && <DevicesDialog member={member} onClose={close} />}
      {opened === "delete" && <DeleteDialog member={member} onClose={close} />}
    </div>
  );
}
