/**
 * /api/apps/:id/api-keys — 应用级 API Key 轮换 / 列出 / 吊销
 */
import { Router } from "express";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router({ mergeParams: true });

function now() { return new Date().toISOString(); }
function randomSecret() {
  // 32-byte random → base64url
  return "mpk_" + crypto.randomBytes(28).toString("base64url");
}
function hashSecret(secret, salt) {
  return crypto.createHash("sha256").update(salt + ":" + secret).digest("hex");
}

function rowToKey(r, includePlaintext) {
  return {
    id: r.id,
    appId: r.app_id,
    label: r.label,
    secretPrefix: r.secret_prefix,
    secretLast4: r.secret_last4,
    scopes: r.scopes ? JSON.parse(r.scores ?? r.scopes) : [],
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    rotatedFrom: r.rotated_from,
    createdAt: r.created_at,
    createdBy: r.created_by,
    // 仅在创建 / rotate 时返回一次性明文 + salt (之后再次获取仅返回 prefix/last4)
    ...(includePlaintext ? { secret: r._plaintext, salt: r._salt } : {}),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_api_keys WHERE app_id = ? ORDER BY created_at DESC"
    ).all(req.params.id);
    const data = rows.map((r) => ({
      id: r.id,
      appId: r.app_id,
      label: r.label,
      secretPrefix: r.secret_prefix,
      secretLast4: r.secret_last4,
      scopes: r.scopes ? safeJSON(r.scopes) : [],
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      rotatedFrom: r.rotated_from,
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { label, scopes, expiresAt } = req.body || {};
    if (!label) return res.status(400).json({ success: false, error: "label 为必填项" });
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const id = uuid();
    const secret = randomSecret();
    const salt = crypto.randomBytes(8).toString("hex");
    const secretHash = hashSecret(secret, salt);
    const secretPrefix = secret.slice(0, 12);
    const secretLast4 = secret.slice(-4);
    const n = now();
    await db.prepare(
      `INSERT INTO app_api_keys (id, app_id, label, secret_prefix, secret_hash, secret_last4, scopes, expires_at, rotated_from, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.params.id, label, secretPrefix, secretHash, secretLast4,
      JSON.stringify(Array.isArray(scopes) ? scopes : []),
      expiresAt || null, null,
      req.user?.id || null,
      n, n,
    );
    res.status(201).json({
      success: true,
      data: {
        id, appId: req.params.id, label, secretPrefix, secretLast4,
        scopes: Array.isArray(scopes) ? scopes : [],
        expiresAt: expiresAt || null,
        createdAt: n,
        // 仅在创建时返回明文 + salt
        secret,
        salt,
      },
    });
  } catch (err) { next(err); }
});

router.post("/:keyId/rotate", async (req, res, next) => {
  try {
    const oldKey = await db.prepare(
      "SELECT * FROM app_api_keys WHERE id = ? AND app_id = ?"
    ).get(req.params.keyId, req.params.id);
    if (!oldKey) return res.status(404).json({ success: false, error: "Key 不存在" });
    // 撤销旧 key
    await db.prepare(
      "UPDATE app_api_keys SET revoked_at = ?, updated_at = ? WHERE id = ?"
    ).run(now(), now(), req.params.keyId);
    // 生成新 key, 标记 rotated_from
    const id = uuid();
    const secret = randomSecret();
    const salt = crypto.randomBytes(8).toString("hex");
    const secretHash = hashSecret(secret, salt);
    const secretPrefix = secret.slice(0, 12);
    const secretLast4 = secret.slice(-4);
    const n = now();
    await db.prepare(
      `INSERT INTO app_api_keys (id, app_id, label, secret_prefix, secret_hash, secret_last4, scopes, expires_at, rotated_from, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.params.id, oldKey.label, secretPrefix, secretHash, secretLast4,
      oldKey.scopes || "[]", oldKey.expires_at, oldKey.id,
      req.user?.id || null,
      n, n,
    );
    res.json({
      success: true,
      data: {
        id, label: oldKey.label, secretPrefix, secretLast4,
        rotatedFrom: oldKey.id,
        createdAt: n,
        secret,
        salt,
      },
    });
  } catch (err) { next(err); }
});

router.delete("/:keyId", async (req, res, next) => {
  try {
    const result = await db.prepare(
      "UPDATE app_api_keys SET revoked_at = ?, updated_at = ? WHERE id = ? AND app_id = ? AND revoked_at IS NULL"
    ).run(now(), now(), req.params.keyId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: "Key 不存在或已撤销" });
    res.json({ success: true });
  } catch (err) { next(err); }
});

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return []; }
}

export default router;
