// The live chat server, on Cloudflare. It never sees messages: the site saves
// them as usual and then tells this server "something changed in cause X";
// this server passes that on to every browser with X's chat open, and they
// fetch the new messages from the site. Who may read what stays in the site.
//
//   GET  /connect?token=…        a browser opens a live connection (WebSocket)
//   POST /rooms/:id/changed      the site announces a change (needs CHAT_SECRET)
//
// Each cause is a "room": one Durable Object holding that cause's open
// connections. Idle connections hibernate, so they cost nothing between pings.

import { DurableObject } from "cloudflare:workers";
import { isRoomId, originAllowed, safeEqual, verifyChatToken } from "../../src/lib/chat-token";

export interface Env {
  ROOMS: DurableObjectNamespace<ChatRoom>;
  /** Shared with the site. Signs passes and authorizes announcements. */
  CHAT_SECRET: string;
  /** Comma-separated origins allowed to connect (see originAllowed). */
  ALLOWED_ORIGINS: string;
}

/** Close code telling the browser its pass was refused, so it fetches a fresh one instead of retrying. */
const PASS_REFUSED = 4001;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket.", { status: 426 });
      if (!originAllowed(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) return new Response("Forbidden.", { status: 403 });
      const room = await verifyChatToken(env.CHAT_SECRET, url.searchParams.get("token") ?? "");
      if (!room) {
        // Accept, then close with a code the page understands. (A plain 403 looks the same as "server down" to a browser.)
        const [client, server] = Object.values(new WebSocketPair());
        server.accept();
        server.close(PASS_REFUSED, "Pass expired or invalid");
        return new Response(null, { status: 101, webSocket: client });
      }
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }

    const changed = url.pathname.match(/^\/rooms\/([^/]+)\/changed$/);
    if (changed && request.method === "POST") {
      const auth = request.headers.get("Authorization") ?? "";
      if (!safeEqual(auth, `Bearer ${env.CHAT_SECRET}`)) return new Response("Unauthorized.", { status: 401 });
      if (!isRoomId(changed[1])) return new Response("Bad room.", { status: 400 });
      const listeners = await env.ROOMS.get(env.ROOMS.idFromName(changed[1])).announce();
      return Response.json({ listeners });
    }

    return new Response("Not found.", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Browsers send "ping" every 30 seconds to keep the line open. Answering
    // here doesn't wake the room, so quiet chats stay free.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Tells everyone in the room to fetch the latest messages. Returns how many were told. */
  async announce(): Promise<number> {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send("changed");
      } catch {
        // Already closing; nothing to do.
      }
    }
    return sockets.length;
  }

  async webSocketMessage() {
    // Browsers only send pings, which are answered automatically.
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "Bye");
    } catch {
      // Already closed.
    }
  }
}
