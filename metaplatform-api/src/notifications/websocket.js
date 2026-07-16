/**
 * WebSocket gateway for real-time notifications (Phase 7 — Notifications)
 *
 * - Subscribers connect via ws://host/api/notifications/ws?token=...
 * - On connect, joins a "user:{id}" channel
 * - When notify() emits an event, it fans out to all sockets for that user
 * - Heartbeats every 30s; closes dead connections after 60s
 */

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { notificationBus } from "./manager.js";
import { logger } from "../observability/logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "metaplatform-prod-secret-change-in-production";

export function attachNotificationWs(httpServer, path = "/api/notifications/ws") {
  const wss = new WebSocketServer({ server: httpServer, path });

  // Subscribe to the notification bus once
  notificationBus.on("notification", (notification) => {
    const payload = JSON.stringify({ type: "notification", data: notification });
    for (const client of wss.clients) {
      if (client.readyState === 1 && client.userId === notification.userId) {
        client.send(payload);
      }
    }
  });

  wss.on("connection", (ws, req) => {
    ws.isAlive = true;
    ws.userId = null;

    // Authenticate via query param
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        ws.userId = decoded.sub || decoded.id;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", error: "invalid_token" }));
      ws.close(1008, "auth_failed");
      return;
    }

    if (!ws.userId) {
      ws.close(1008, "missing_user");
      return;
    }

    ws.send(JSON.stringify({ type: "hello", userId: ws.userId }));
    logger.info("ws.connected", { userId: ws.userId });

    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
      } catch {}
    });
    ws.on("close", () => {
      logger.info("ws.disconnected", { userId: ws.userId });
    });
  });

  // Heartbeat loop
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  return wss;
}

export default { attachNotificationWs };