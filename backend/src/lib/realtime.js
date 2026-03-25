import crypto from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { resolveUserFromToken } from "../middleware/auth.js";

const sessions = new Map();

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function parseFrame(frameText) {
  const normalized = frameText.replace(/\r/g, "");
  const separatorIndex = normalized.indexOf("\n\n");

  if (separatorIndex === -1) {
    return null;
  }

  const headerBlock = normalized.slice(0, separatorIndex);
  const body = normalized.slice(separatorIndex + 2);
  const [command, ...headerLines] = headerBlock.split("\n");

  if (!command) {
    return null;
  }

  const headers = {};
  for (const line of headerLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    headers[key] = value;
  }

  return {
    command: command.trim().toUpperCase(),
    headers,
    body
  };
}

function buildFrame(command, headers = {}, body = "") {
  const lines = [command];
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}:${value}`);
  }
  return `${lines.join("\n")}\n\n${body}\0`;
}

function sendFrame(ws, command, headers = {}, body = "") {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(buildFrame(command, headers, body));
}

function getSession(ws) {
  let session = sessions.get(ws);
  if (!session) {
    session = {
      user: null,
      subscriptions: new Map()
    };
    sessions.set(ws, session);
  }
  return session;
}

async function handleConnect(ws, headers) {
  const normalizedHeaders = normalizeHeaders(headers);
  const authHeader = normalizedHeaders.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const user = await resolveUserFromToken(token);
  if (!user) {
    sendFrame(ws, "ERROR", { message: "Unauthorized" }, "Invalid token");
    ws.close();
    return;
  }

  const session = getSession(ws);
  session.user = user;

  sendFrame(ws, "CONNECTED", {
    version: normalizedHeaders["accept-version"] ?? "1.2",
    "heart-beat": "0,0"
  });
}

function handleSubscribe(ws, headers) {
  const session = getSession(ws);
  if (!session.user) {
    sendFrame(ws, "ERROR", { message: "Unauthorized" }, "Connect first");
    ws.close();
    return;
  }

  const id = headers.id;
  const destination = headers.destination;
  if (!id || !destination) {
    return;
  }

  session.subscriptions.set(id, destination);

  if (headers.receipt) {
    sendFrame(ws, "RECEIPT", { "receipt-id": headers.receipt });
  }
}

function handleUnsubscribe(ws, headers) {
  const session = sessions.get(ws);
  if (!session || !headers.id) {
    return;
  }

  session.subscriptions.delete(headers.id);
}

function handleDisconnect(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}

async function handleFrame(ws, frame) {
  switch (frame.command) {
    case "CONNECT":
    case "STOMP":
      await handleConnect(ws, frame.headers);
      break;
    case "SUBSCRIBE":
      handleSubscribe(ws, frame.headers);
      break;
    case "UNSUBSCRIBE":
      handleUnsubscribe(ws, frame.headers);
      break;
    case "DISCONNECT":
      handleDisconnect(ws);
      break;
    default:
      break;
  }
}

export function attachRealtimeServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    getSession(ws);

    ws.on("message", async (data) => {
      const payload = data.toString();
      const frames = payload.split("\0");

      for (const chunk of frames) {
        if (!chunk || !chunk.replace(/\r?\n/g, "").trim()) {
          continue;
        }

        const frame = parseFrame(chunk);
        if (!frame) {
          continue;
        }

        await handleFrame(ws, frame);
      }
    });

    ws.on("close", () => {
      sessions.delete(ws);
    });
  });

  return wss;
}

export function sendToUser(userId, destination, payload) {
  const body = JSON.stringify(payload);

  for (const [ws, session] of sessions.entries()) {
    if (session.user?.id !== userId) {
      continue;
    }

    for (const [subscriptionId, subscribedDestination] of session.subscriptions.entries()) {
      if (subscribedDestination !== destination) {
        continue;
      }

      sendFrame(
        ws,
        "MESSAGE",
        {
          subscription: subscriptionId,
          destination,
          "message-id": crypto.randomUUID(),
          "content-type": "application/json"
        },
        body
      );
    }
  }
}
