import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";
import { SocialButtons } from "@/components/social-buttons";
import { enabledSocialProviders } from "@/lib/better-auth";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  reset: "Your password was changed and you were signed out everywhere. Sign in with your new password.",
};

export default function SignInPage(props: PageProps<"/signin">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <Suspense fallback={<SignInForm />}>
        {props.searchParams.then((sp) => {
          const next = typeof sp.next === "string" ? sp.next : undefined;
          const notice = sp.reset ? NOTICES.reset : null;
          // Better Auth sends people back here with ?error=… if Google/Apple sign-in fails.
          const oauthError = typeof sp.error === "string";
          return (
            <>
              {notice && <p role="status" className="mb-4 rounded-lg bg-brand-soft p-3 text-sm">{notice}</p>}
              {oauthError && (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  That sign-in didn&apos;t work. Please try again, or use your email and password.
                </p>
              )}
              <SocialButtons providers={enabledSocialProviders} next={next} />
              <SignInForm next={next} />
            </>
          );
        })}
      </Suspense>
    </div>
  );
}
