import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-ui";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "สมัครสมาชิก" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <AuthCard watermark="SIGNUP" title="สมัครสมาชิก" subtitle="สร้างบัญชีเพื่อกดบัตรได้ทันทีเมื่อเปิดขาย">
      {/* The card is static; reading ?next= and the session waits for the request */}
      <Suspense fallback={<SignupForm next="/" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return <SignupForm next={next} />;
}
