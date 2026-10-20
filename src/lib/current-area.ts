import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { AREA_COOKIE, decodeArea, type Area } from "./area-cookie";

/** "Your neighbourhood": the area you last looked at, or else your home area. */
export async function currentArea(): Promise<Area | null> {
  const fromCookie = decodeArea((await cookies()).get(AREA_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const user = await getCurrentUser();
  if (!user?.homeCountry || !user.homePostal) return null;
  const place = await db.place.findUnique({
    where: { id: `${user.homeCountry}-${user.homePostal}` },
    select: { placeName: true },
  });
  return place ? { country: user.homeCountry, postal: user.homePostal, name: place.placeName } : null;
}
