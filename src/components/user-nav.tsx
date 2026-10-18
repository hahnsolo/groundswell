import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { areaHref } from "@/lib/countries";

export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/signin" className="rounded-lg px-3 py-1.5 hover:bg-brand-soft">
          Sign in
        </Link>
        <Link href="/signup" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-strong">
          Join
        </Link>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-1 text-sm">
      {user.homeCountry && user.homePostal && (
        <Link href={areaHref(user.homeCountry, user.homePostal)} className="rounded-lg px-3 py-1.5 hover:bg-brand-soft">
          My area
        </Link>
      )}
      <Link href="/me" className="rounded-lg px-3 py-1.5 hover:bg-brand-soft">
        {user.name.split(" ")[0]}
      </Link>
      <form action={signOut}>
        <button className="rounded-lg px-3 py-1.5 text-muted hover:bg-brand-soft">Sign out</button>
      </form>
    </nav>
  );
}
