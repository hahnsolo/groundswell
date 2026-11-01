import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { IssueForm } from "@/components/issue-form";

export const metadata: Metadata = { title: "Start a cause" };

export default function NewIssuePage(props: PageProps<"/causes/new">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Start a cause</h1>
      <p className="mb-8 mt-1 text-muted">
        Neighbours nearby will see it, can add their support, and organize around it.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-border/60" />}>
        <NewIssue searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function NewIssue({ searchParams }: Pick<PageProps<"/causes/new">, "searchParams">) {
  const sp = await searchParams;
  const country = typeof sp.country === "string" ? sp.country : undefined;
  const postal = typeof sp.postal === "string" ? sp.postal : undefined;
  const qs = new URLSearchParams({ ...(country && { country }), ...(postal && { postal }) }).toString();
  const user = await requireUser(`/causes/new${qs ? `?${qs}` : ""}`);
  return <IssueForm country={country ?? user.homeCountry ?? "US"} postal={postal ?? user.homePostal ?? ""} />;
}
