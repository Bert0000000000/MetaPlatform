package com.metaplatform.data.util;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.exception.DataException;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM 凭证加密工具（v1.3 升级：ECB → GCM）。
 *
 * <p>SHA-256 派生 32 字节密钥，GCM 模式提供机密性 + 完整性 + 12 字节 IV。
 * 密文格式：Base64(IV[12] || Ciphertext[N] || Tag[16])。</p>
 *
 * <p>向后兼容：自动检测旧 ECB 密文（无 GCM 标记位），降级到 ECB 解密后建议轮换。</p>
 */
@Slf4j
public final class CryptoUtil {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String LEGACY_TRANSFORMATION = "AES/ECB/PKCS7Padding";
    private static final String SHA_256 = "SHA-256";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final String GCM_MARKER = "gcm:";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private CryptoUtil() {
    }

    private static byte[] deriveKey(String passphrase) {
        try {
            MessageDigest digest = MessageDigest.getInstance(SHA_256);
            return digest.digest(passphrase.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new DataException(ErrorCode.INTERNAL_ERROR, "密钥派生失败: " + e.getMessage(), e);
        }
    }

    /**
     * 加密明文为 Base64 字符串（GCM 模式，前缀 "gcm:"）。
     */
    public static String encrypt(String plaintext, String passphrase) {
        try {
            byte[] key = deriveKey(passphrase);
            byte[] iv = new byte[GCM_IV_LENGTH];
            SECURE_RANDOM.nextBytes(iv);

            SecretKeySpec keySpec = new SecretKeySpec(key, ALGORITHM);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);

            return GCM_MARKER + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("加密失败 | msg={}", e.getMessage());
            throw new DataException(ErrorCode.INTERNAL_ERROR, "凭证加密失败: " + e.getMessage(), e);
        }
    }

    /**
     * 解密 Base64 字符串为明文（自动识别 GCM 新格式与 ECB 旧格式）。
     */
    public static String decrypt(String ciphertext, String passphrase) {
        try {
            byte[] key = deriveKey(passphrase);
            SecretKeySpec keySpec = new SecretKeySpec(key, ALGORITHM);

            if (ciphertext.startsWith(GCM_MARKER)) {
                return decryptGcm(keySpec, ciphertext.substring(GCM_MARKER.length()));
            }
            return decryptLegacyEcb(keySpec, ciphertext);
        } catch (Exception e) {
            log.error("解密失败 | msg={}", e.getMessage());
            throw new DataException(ErrorCode.INTERNAL_ERROR, "凭证解密失败: " + e.getMessage(), e);
        }
    }

    private static String decryptGcm(SecretKeySpec keySpec, String base64) throws Exception {
        byte[] combined = Base64.getDecoder().decode(base64);
        byte[] iv = new byte[GCM_IV_LENGTH];
        byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
        System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
        System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    private static String decryptLegacyEcb(SecretKeySpec keySpec, String base64) throws Exception {
        Cipher cipher = Cipher.getInstance(LEGACY_TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, keySpec);
        byte[] decoded = Base64.getDecoder().decode(base64);
        return new String(cipher.doFinal(decoded), StandardCharsets.UTF_8);
    }

    /**
     * 判断密文是否为新版 GCM 格式（用于轮换检测）。
     */
    public static boolean isGcmFormat(String ciphertext) {
        return ciphertext != null && ciphertext.startsWith(GCM_MARKER);
    }
}
