import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Join" };

export default function SignUpPage(props: PageProps<"/signup">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Join your community</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Support issues, join meetups and sign campaigns near you.</p>
      <Suspense fallback={<SignUpForm />}>
        {props.searchParams.then((sp) => (
          <SignUpForm next={typeof sp.next === "string" ? sp.next : undefined} />
        ))}
      </Suspense>
    </div>
  );
}
