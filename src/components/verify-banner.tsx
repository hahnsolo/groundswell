import { getCurrentUser } from "@/lib/auth";
import { confirmEmailDelayed } from "@/lib/confirm-email";
import { ResendVerificationButton } from "./account-forms";

export async function VerifyBanner() {
  const user = await getCurrentUser();
  if (!user || user.emailVerified) return null;
  const delayed = await confirmEmailDelayed(user.id);
  return (
    <div className="bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
      <div className="mx-auto max-w-5xl px-4 py-2 text-sm">
        {delayed ? (
          <>
            Our email is backed up, so your confirmation link for <strong>{user.email}</strong> may take until tomorrow. You can look around and join causes in the meantime.{" "}
          </>
        ) : (
          <>
            Confirm your email (<strong>{user.email}</strong>) to start causes, chat and organize events.{" "}
          </>
        )}
        <ResendVerificationButton />
      </div>
    </div>
  );
}
