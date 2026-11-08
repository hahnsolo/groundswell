// How many sign-in and sign-up attempts we allow, and what we say when someone
// is blocked. Plain numbers and words, so the tests can check them. The reasoning
// and the trade-off are in docs/security-and-spam.md.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Everyone on one wifi network usually shares one network address, so these have
// to fit a whole room of 100: everyone signing in with a retry each, or everyone
// signing up. Forms sent back for a typo don't count against either.
export const SIGN_IN_PER_ADDRESS = { limit: 200, windowMs: 15 * MINUTE };
export const SIGN_UP_PER_ADDRESS = { limit: 100, windowMs: HOUR };

// This is what stops password guessing, wherever the guesses come from.
export const SIGN_IN_PER_ACCOUNT = { limit: 10, windowMs: 15 * MINUTE };

// Better Auth's own limits, for its public web addresses (window in seconds). Our
// forms are Server Actions and never count against these, so raising the two email
// rules wouldn't help a room. It would help bots: those addresses have no per-account limit.
export const BETTER_AUTH_RATE_LIMIT_RULES = {
  "/sign-in/email": { window: 15 * 60, max: 20 },
  "/sign-up/email": { window: 60 * 60, max: 10 },
  // The Google and Apple buttons do use this one. It only sends people on to the
  // provider, and without this rule they'd get the built-in 3 per 10 seconds.
  "/sign-in/social": { window: 60, max: 100 },
  "/request-password-reset": { window: 60 * 60, max: 5 },
  "/send-verification-email": { window: 60 * 60, max: 5 },
};

const SHARED_WIFI = "This can happen on shared wifi at a busy event.";

export const SIGN_IN_ADDRESS_BLOCKED = `Too many sign-ins from this network right now. ${SHARED_WIFI} Switch to mobile data, or try again within 15 minutes.`;
export const SIGN_UP_ADDRESS_BLOCKED = `Too many sign-ups from this network right now. ${SHARED_WIFI} Switch to mobile data, or try again within the hour.`;
export const SOCIAL_ADDRESS_BLOCKED = `Too many sign-ins from this network right now. ${SHARED_WIFI} Switch to mobile data, or try again in a minute.`;

// A password reset doesn't lift this block, so don't suggest that it will.
export const SIGN_IN_ACCOUNT_BLOCKED =
  "Too many attempts for this account. Wait 15 minutes and try again. If you've forgotten your password, you can reset it while you wait.";
