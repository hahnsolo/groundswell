import "server-only";
import { after } from "next/server";
import { signChatToken } from "./chat-token";

// The site's side of live chat (the server itself is in realtime/). Live chat
// is on when CHAT_URL and CHAT_SECRET are set; without them, chat pages check
// for new messages every few seconds instead, so nothing breaks.

function config() {
  const url = process.env.CHAT_URL;
  const secret = process.env.CHAT_SECRET;
  return url && secret ? { url: url.replace(/\/+$/, ""), secret } : null;
}

export type ChatPass = { url: string; token: string };

/** A pass to listen to a cause's chat. Only give it to people allowed to read that chat. */
export async function chatPass(causeId: string): Promise<ChatPass | null> {
  const c = config();
  if (!c) return null;
  return { url: c.url.replace(/^http/, "ws"), token: await signChatToken(c.secret, causeId) };
}

/**
 * Tells everyone with this cause's chat open to fetch the latest messages.
 * Runs after the response is sent, and never fails the action that called it:
 * if the chat server is down, open chats catch up on their next check.
 */
export function announceChatChange(causeId: string) {
  const c = config();
  if (!c) return;
  after(async () => {
    try {
      await fetch(`${c.url}/rooms/${causeId}/changed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.secret}` },
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) {
      console.warn("Live chat announcement failed:", (e as Error).message);
    }
  });
}
