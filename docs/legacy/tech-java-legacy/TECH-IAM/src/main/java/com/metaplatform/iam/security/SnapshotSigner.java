package com.metaplatform.iam.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * PermissionSnapshot 签名器（HMAC-SHA256）。
 *
 * <p>防止下游消费方（如 DeerFlow Adapter / TECH-ONT）收到篡改后的快照数据。
 * 签名覆盖 {@code tenantId|userId|subjectConcept|subjectId|snapshotData|expiresAt}。</p>
 *
 * <p>密钥从配置 {@code mate.iam.snapshot.secret} 注入，默认 dev key 见
 * application-dev.yml。生产环境必须使用 KMS 或 Vault 注入。</p>
 */
public final class SnapshotSigner {

    private static final String ALGO = "HmacSHA256";
    private static final char SEP = '|';

    private final SecretKeySpec keySpec;

    public SnapshotSigner(String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("snapshot secret 必须 ≥ 16 字符");
        }
        this.keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGO);
    }

    public String sign(String tenantId, String userId, String subjectConcept,
                       String subjectId, String snapshotData, long expiresAtEpochMillis) {
        String payload = String.join(String.valueOf(SEP),
                safe(tenantId), safe(userId), safe(subjectConcept),
                safe(subjectId), safe(snapshotData), String.valueOf(expiresAtEpochMillis));
        try {
            Mac mac = Mac.getInstance(ALGO);
            mac.init(keySpec);
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("snapshot 签名失败", e);
        }
    }

    public boolean verify(String tenantId, String userId, String subjectConcept,
                          String subjectId, String snapshotData, long expiresAtEpochMillis,
                          String expectedSignature) {
        String actual = sign(tenantId, userId, subjectConcept, subjectId, snapshotData, expiresAtEpochMillis);
        return constantTimeEquals(actual, expectedSignature);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }

    private static String safe(String s) {
        return s == null ? "" : s.replace(SEP, '_');
    }
}
