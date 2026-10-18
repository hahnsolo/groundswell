"use client";

import { createAuthClient } from "better-auth/react";

// Browser-side client. Only used for flows that must start in the browser
// (Google/Apple redirects); everything else goes through Server Actions.
export const authClient = createAuthClient();
