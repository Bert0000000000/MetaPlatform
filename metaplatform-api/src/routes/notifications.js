/**
 * /api/notifications — REST endpoints (Phase 7 — Notifications)
 *
 *   GET    /api/notifications                    List current user's notifications
 *   GET    /api/notifications/unread-count       Count unread
 *   POST   /api/notifications/test               Send a test notification (dev convenience)
 *   POST   /api/notifications/:id/read          Mark one read
 *   POST   /api/notifications/read-all          Mark all read
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as notify from "../notifications/manager.js";

const router = Router();

router.get("/", authenticate, (req, res) => {
  const { limit, unreadOnly, since } = req.query;
  const data = notify.listForUser(req.user.id, {
    limit: limit ? parseInt(limit, 10) : 50,
    unreadOnly: unreadOnly === "true",
    since: since || undefined,
  });
  res.json({ success: true, data });
});

router.get("/unread-count", authenticate, (req, res) => {
  res.json({ success: true, data: { count: notify.unreadCount(req.user.id) } });
});

router.post("/test", authenticate, async (req, res, next) => {
  try {
    const r = await notify.notify({
      userId: req.user.id,
      category: req.body.category || "test",
      title: req.body.title || "Test notification",
      body: req.body.body || "This is a test notification from MetaPlatform.",
      data: req.body.data,
      channels: req.body.channels || ["inapp"],
    });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
});

router.post("/:id/read", authenticate, (req, res) => {
  const ok = notify.markRead(req.params.id, req.user.id);
  res.json({ success: true, data: { marked: ok } });
});

router.post("/read-all", authenticate, (req, res) => {
  const n = notify.markAllRead(req.user.id);
  res.json({ success: true, data: { marked: n } });
});

export default router;