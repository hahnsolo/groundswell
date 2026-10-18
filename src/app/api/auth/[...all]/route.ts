import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";

// Better Auth's endpoints: OAuth redirects/callbacks, email verification and
// password-reset links, plus the JSON API used by the client.
export const { GET, POST } = toNextJsHandler(auth);
