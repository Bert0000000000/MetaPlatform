package com.metaplatform.ont.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Envelope 签名器（P1.2.4）。
 *
 * <p>独立于 IAM 的 SnapshotSigner，单独为 Ontology Context Envelope 服务。
 * 后续若需要与 IAM 共用密钥，可统一改为共享实现。</p>
 */
public class ContextSnapshotSigner {

    private final SecretKeySpec keySpec;

    public ContextSnapshotSigner(String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("snapshot secret 必须 ≥ 16 字符");
        }
        this.keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public String signForContext(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(keySpec);
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("context envelope 签名失败", e);
        }
    }
}
