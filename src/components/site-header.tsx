import Link from "next/link";
import { Suspense } from "react";
import { currentArea } from "@/lib/current-area";
import { LogoMark } from "./logo";
import { NeighbourhoodPicker, StartSomething } from "./neighbourhood";
import { UserNav } from "./user-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b-[1.5px] border-ink bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Groundswell home">
          <LogoMark className="h-[22px] w-[30px]" />
          <span className="hidden font-display text-xl font-semibold tracking-tight min-[420px]:inline">Groundswell</span>
        </Link>
        <Suspense fallback={<div className="ml-auto h-8 w-40" />}>
          <HeaderActions />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderActions() {
  const area = await currentArea();
  return (
    <>
      <NeighbourhoodPicker initial={area} />
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <StartSomething initial={area} />
        <UserNav />
      </div>
    </>
  );
}
