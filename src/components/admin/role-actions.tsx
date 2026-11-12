"use client";

import { useActionState, useId, useState } from "react";
import { Delete02Icon, Loading03Icon, PencilEdit02Icon, PlusSignIcon, ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { deleteRole, saveRole } from "@/app/actions/admin-roles";
import { AdminDialog } from "@/components/admin/dialog";
import { Notice, label } from "@/components/admin/form";
import { iconButton, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { CheckBox } from "@/components/ui/switch";
import { Hint } from "@/components/ui/hint";
import { PERMISSIONS } from "@/lib/permissions";

// สร้าง / แก้ไข / ลบ โรล (app/admin/roles). The ticks come straight from lib/permissions.ts, so a permission
// added there shows up here by itself.

export type RoleRow = { id: string; name: string; description: string; permissions: string[]; members: number };

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

function RoleDialog({ role, onClose }: { role?: RoleRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveRole, {});
  const ids = useId();
  return (
    <AdminDialog onClose={onClose} done={Boolean(state.ok)} icon={ShieldKeyIcon} title={role ? `แก้ไข ${role.name}` : "สร้างโรล"} subtitle="ติ๊กสิ่งที่โรลนี้ทำได้" width="38rem">
      <form action={action} className="space-y-4">
        {role && <input type="hidden" name="roleId" value={role.id} />}
        <Notice state={state} />
        <div>
          <label htmlFor={`${ids}-name`} className={label}>
            ชื่อโรล
          </label>
          <input id={`${ids}-name`} name="name" required maxLength={60} defaultValue={role?.name} placeholder="เช่น หัวหน้าทีมประตู" className={input} />
        </div>
        <div>
          <label htmlFor={`${ids}-description`} className={label}>
            คำอธิบาย (ไม่บังคับ)
          </label>
          <input id={`${ids}-description`} name="description" maxLength={200} defaultValue={role?.description} className={input} />
        </div>

        {GROUPS.map((group) => (
          <fieldset key={group}>
            <legend className={label}>{group}</legend>
            <div className="space-y-2">
              {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                <label
                  key={p.key}
                  className="group relative flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 transition-colors select-none hover:border-muted-foreground/50 has-checked:border-foreground/40 has-checked:bg-secondary/60"
                >
                  <CheckBox name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{p.label}</span>
                    <span className="block text-2xs text-muted-foreground">{p.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          <button type="submit" disabled={pending} className={pillPrimary}>
            {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
            บันทึก
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

function DeleteDialog({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteRole, {});
  return (
    <AdminDialog onClose={onClose} done={Boolean(state.ok)} danger icon={Delete02Icon} title={`ลบ ${role.name}`} subtitle="ย้อนกลับไม่ได้" width="28rem">
      <form action={action} className="space-y-4">
        <input type="hidden" name="roleId" value={role.id} />
        <Notice state={state} />
        <p className="text-sm text-muted-foreground">
          {role.members > 0 ? `ทีมงาน ${role.members} คนที่ใช้โรลนี้จะกลับเป็นสมาชิกทั่วไป และเข้าหลังบ้านไม่ได้จนกว่าจะตั้งโรลใหม่` : "ยังไม่มีใครใช้โรลนี้"}
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-70"
          >
            {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
            ลบโรล
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

export function NewRoleButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${pillPrimary} max-sm:flex-1 max-sm:justify-center`}>
        <Icon icon={PlusSignIcon} className="size-4" />
        สร้างโรลใหม่
      </button>
      {open && <RoleDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function RoleActions({ role }: { role: RoleRow }) {
  const [opened, setOpened] = useState<"edit" | "delete" | null>(null);
  const close = () => setOpened(null);
  return (
    <div className="flex justify-end gap-1.5">
      <Hint label="แก้ไข">
        <button type="button" aria-label={`แก้ไข ${role.name}`} onClick={() => setOpened("edit")} className={iconButton}>
          <Icon icon={PencilEdit02Icon} className="size-4" />
        </button>
      </Hint>
      <Hint label="ลบ">
        <button type="button" aria-label={`ลบ ${role.name}`} onClick={() => setOpened("delete")} className={`${iconButton} hover:border-red-500/40 hover:text-red-500`}>
          <Icon icon={Delete02Icon} className="size-4" />
        </button>
      </Hint>
      {opened === "edit" && <RoleDialog role={role} onClose={close} />}
      {opened === "delete" && <DeleteDialog role={role} onClose={close} />}
    </div>
  );
}
