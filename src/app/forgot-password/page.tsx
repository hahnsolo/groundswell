import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <ForgotPasswordForm />
    </div>
  );
}
