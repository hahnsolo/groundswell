import type { Metadata } from "next";
import Link from "next/link";
import { ACCOUNT_GRACE_DAYS } from "@/lib/accounts";
import { buttonStyles } from "@/components/styles";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function GoodbyePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Your account is deleted</h1>
      <p className="mt-3 text-muted">
        You&apos;ve been signed out everywhere. What you posted stays up, credited to &ldquo;Former member&rdquo;.
      </p>
      <p className="mt-3 text-muted">
        Changed your mind? Sign in within {ACCOUNT_GRACE_DAYS} days and your account comes back. After that your name,
        email and password are erased for good.
      </p>
      <Link href="/" className={`${buttonStyles.secondary} mt-8`}>
        Back to Groundswell
      </Link>
    </div>
  );
}
