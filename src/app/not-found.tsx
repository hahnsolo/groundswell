import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Nothing here</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist, or it was removed.</p>
      <Link href="/" className="mt-6 inline-block text-brand-strong underline dark:text-brand">
        Back to the start
      </Link>
    </div>
  );
}
