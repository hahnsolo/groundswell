import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { peekToken } from "@/lib/tokens";
import { VerifyEmailForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Confirm your email" };

// The link only shows a button; the token is used on submit (a POST), so email
// scanners that pre-open links can't burn it.
export default function VerifyPage(props: PageProps<"/verify">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Confirm your email</h1>
      <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-border/60" />}>
        <Verify searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Verify({ searchParams }: Pick<PageProps<"/verify">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !(await peekToken(token, "verify_email"))) {
    return (
      <p className="text-muted">
        This link is invalid, expired or already used. <Link href="/me" className="underline">Go to your account</Link> to
        request a new one.
      </p>
    );
  }
  return <VerifyEmailForm token={token} />;
}
