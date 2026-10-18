import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage(props: PageProps<"/signin">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <Suspense fallback={<SignInForm />}>
        {props.searchParams.then((sp) => (
          <SignInForm next={typeof sp.next === "string" ? sp.next : undefined} />
        ))}
      </Suspense>
    </div>
  );
}
