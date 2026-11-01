# Live chat

New messages in a cause's chat appear for everyone straight away, without refreshing.

## How it works

```
  Sam sends a message                         Alex has the chat open
         │                                              ▲
         ▼                                              │ 3. Alex's page fetches the
  ┌──────────────┐  2. "something changed    ┌────────────────────┐   new messages from
  │  The site    │ ───── in cause X" ──────► │  Chat server       │   the site, as usual
  │  (Vercel)    │                           │  (Cloudflare)      │
  │              │ ◄─────────────────────────┤  one "room" per    │
  └──────────────┘   (no message text ever   │  cause             │
  1. saves it in the   goes to Cloudflare)   └────────────────────┘
     database
```

1. The site saves the message exactly as before, with all the usual rules: members only, the 24-hour wait, spam checks.
2. It then tells the **chat server** on Cloudflare "something changed in cause X". That's all it sends: no message text, no names.
3. The chat server passes that on to every browser with cause X's chat open. Each browser asks the site for the latest messages, so who can see what is still decided by the site alone.

**Passes:** when someone allowed to read a chat opens it, the site gives their browser a pass for that one cause, valid for 1–2 hours. The chat server only lets browsers listen with a valid pass, and only from Groundswell's own addresses.

**If the chat server is down, or over its free limit,** nothing breaks: open chats check for new messages every 10 seconds instead and say so under the chat heading. Messages are never lost, because they always live in our own database.

Moderation updates live too: when a message is removed, restored or hidden after reports, open chats refresh.

## The pieces

| | Live site | Previews |
|---|---|---|
| Chat server | `groundswell-chat.chrishahn88.workers.dev` | `groundswell-chat-preview.chrishahn88.workers.dev` |
| Who may connect | `https://groundswell.hahnsolo.ca` | `https://groundswell-*-hahnsolo.vercel.app` |
| Vercel settings | `CHAT_URL`, `CHAT_SECRET` (Production) | `CHAT_URL`, `CHAT_SECRET` (Preview) |
| Cloudflare secret | `CHAT_SECRET` on `groundswell-chat` | `CHAT_SECRET` on `groundswell-chat-preview` |

`CHAT_SECRET` must be the same in Vercel and Cloudflare for each pair, and different between live and previews. The code is in `realtime/` (the chat server) and `src/lib/live-chat.ts`, `src/lib/chat-token.ts`, `src/components/live-chat.tsx` (the site's side).

## Cost

Cloudflare's free plan: 100,000 requests a day. Opening a chat is one request; chat pings count as 1/20 of a request each; quiet open chats cost nothing. A busy day for a few thousand people uses a small fraction. There's no card on the account, so it can't bill: at the limit, chats fall back to checking every 10 seconds until midnight UTC.

Check usage at Cloudflare → **Workers & Pages** (the "Requests today" box).

## Running it on your PC

Two terminals:

```bash
cd realtime && npm run dev
```

```bash
npm run dev
```

The first time, copy `realtime/.dev.vars.example` to `realtime/.dev.vars`, and add `CHAT_URL` and `CHAT_SECRET` from `.env.example` to `.env`. Then `E2E_EXPECT_LIVE=1 npm run e2e:flows` checks that a message appears in another person's open chat without reloading.

## Updating the chat server

Changes in `realtime/` (or `src/lib/chat-token.ts`, which it shares) go through a PR like everything else. After merging, deploy it from your PC, signed in with `npx wrangler login`:

```bash
cd realtime && npm run deploy:preview && npm run deploy
```

**Changing a secret:** create a new random value, then set it in both places for that pair (Cloudflare: `npx wrangler secret put CHAT_SECRET`, adding `--env preview` for previews; Vercel: Settings → Environment Variables), and redeploy the site. Open chats reconnect on their own.
