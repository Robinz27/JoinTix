import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-ui";
import { LoginForm } from "@/components/auth/login-form";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard watermark="LOGIN" title="เข้าสู่ระบบ" subtitle="เข้าสู่ระบบเพื่อจองบัตรและดูบัตรของคุณ">
      {/* The card is static; reading ?next= and the session waits for the request */}
      <Suspense fallback={<LoginForm next="/" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return <LoginForm next={next} />;
}
