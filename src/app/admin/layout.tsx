import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSkeleton } from "@/components/skeletons";
import { requireSuperAdmin } from "@/lib/session";

// หลังบ้าน sits outside app/(site), so it has its own frame (components/admin/admin-shell.tsx) instead of
// the storefront's navbar and footer.

export const metadata: Metadata = { title: { template: "%s · หลังบ้าน JoinTix", default: "หลังบ้าน JoinTix" }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // The session decides whether there's a back office at all, so the whole frame waits behind a skeleton
    <Suspense fallback={<AdminSkeleton />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  );
}

async function Guarded({ children }: { children: React.ReactNode }) {
  // Pages and actions check again themselves (a layout doesn't re-run on client navigation); this keeps
  // the menu from ever showing to anyone else
  const { user } = await requireSuperAdmin();
  return <AdminShell admin={{ name: user.name, email: user.email }}>{children}</AdminShell>;
}
