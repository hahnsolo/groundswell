import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getInbox } from "@/lib/inbox";
import { UserMenu } from "./user-menu";

/** Signed in: your initial, opening your notifications and activity (#95). Signed out: sign in / join. */
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
  const { unread, items } = await getInbox(user.id, 8);
  return <UserMenu name={user.name} unread={unread} items={items} />;
}
