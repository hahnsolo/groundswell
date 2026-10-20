import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

/** Signed in: your initial, linking to your activity (sign out lives there). Signed out: sign in / join. */
export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/signin" className="rounded-md px-2.5 py-1.5 hover:bg-surface">
          Sign in
        </Link>
        <Link href="/signup" className="hidden rounded-md border-[1.5px] border-ink px-2.5 py-1 font-medium hover:bg-surface sm:inline-block">
          Join
        </Link>
      </nav>
    );
  }
  return (
    <Link
      href="/me"
      title={`${user.name} · your activity`}
      aria-label={`${user.name}: your activity`}
      className="grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-ink bg-mustard text-sm font-semibold text-[#1f2a44] hover:opacity-90"
    >
      {user.name[0]?.toUpperCase()}
    </Link>
  );
}
