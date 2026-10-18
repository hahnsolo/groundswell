import { getCurrentUser } from "@/lib/auth";
import { ResendVerificationButton } from "./account-forms";

export async function VerifyBanner() {
  const user = await getCurrentUser();
  if (!user || user.emailVerified) return null;
  return (
    <div className="bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
      <div className="mx-auto max-w-5xl px-4 py-2 text-sm">
        Confirm your email (<strong>{user.email}</strong>) to post issues, comments and meetups.{" "}
        <ResendVerificationButton />
      </div>
    </div>
  );
}
