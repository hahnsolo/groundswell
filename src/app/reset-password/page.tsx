import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached via Better Auth's emailed link, which checks the token and redirects
// here with ?token=… (valid) or ?error=INVALID_TOKEN.
export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-border/60" />}>
        <Reset searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Reset({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || !token) {
    return (
      <p className="text-muted">
        This reset link is invalid, expired or already used.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm token={token} />;
}
