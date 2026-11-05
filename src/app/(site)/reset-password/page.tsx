import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

// The emailed link goes through Better Auth (/api/auth/reset-password/<token>), which checks the token and
// lands here with ?token=… when it's good or ?error=INVALID_TOKEN when it's expired or used
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthCard watermark="RESET" title="ตั้งรหัสผ่านใหม่" subtitle="ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ">
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={!error && typeof token === "string" && token ? token : null} />;
}
