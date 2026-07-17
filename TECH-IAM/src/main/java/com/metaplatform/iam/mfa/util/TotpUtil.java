package com.metaplatform.iam.mfa.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;

/**
 * RFC 6238 TOTP（基于时间的一次性密码）轻量实现，无外部依赖。
 * - secret 以 Base32 编码字符串存储
 * - 6 位数字，30 秒时间步长
 */
public final class TotpUtil {

    private static final int SECRET_BYTES = 20;
    private static final int TIME_STEP_SECONDS = 30;
    private static final int CODE_DIGITS = 6;
    private static final String BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private TotpUtil() {
    }

    public static String generateSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        new SecureRandom().nextBytes(bytes);
        return encodeBase32(bytes);
    }

    public static String generateTotp(String base32Secret) {
        return generateTotp(base32Secret, System.currentTimeMillis() / 1000L);
    }

    public static String generateTotp(String base32Secret, long unixSeconds) {
        long counter = unixSeconds / TIME_STEP_SECONDS;
        byte[] key = decodeBase32(base32Secret);
        byte[] counterBytes = ByteBuffer.allocate(8).putLong(counter).array();
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(counterBytes);
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int otp = binary % (int) Math.pow(10, CODE_DIGITS);
            return String.format("%0" + CODE_DIGITS + "d", otp);
        } catch (Exception e) {
            throw new IllegalStateException("生成 TOTP 失败", e);
        }
    }

    public static boolean verify(String base32Secret, String code) {
        if (code == null || code.length() != CODE_DIGITS) {
            return false;
        }
        long now = System.currentTimeMillis() / 1000L;
        // 允许前后各一个时间窗口的漂移
        for (long offset = -1; offset <= 1; offset++) {
            String expected = generateTotp(base32Secret, now + offset * TIME_STEP_SECONDS);
            if (expected.equals(code)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 生成 otpauth URI，便于二维码生成器（如 Google Authenticator）识别。
     */
    public static String buildOtpAuthUri(String issuer, String accountName, String base32Secret) {
        String label = urlEncode(issuer + ":" + accountName);
        return "otpauth://totp/" + label
                + "?secret=" + base32Secret
                + "&issuer=" + urlEncode(issuer)
                + "&algorithm=SHA1&digits=" + CODE_DIGITS + "&period=" + TIME_STEP_SECONDS;
    }

    /**
     * 生成可嵌入前端的 Data URI（QR 二维码的简化形式：返回 otpauth 文本，由前端渲染）。
     */
    public static String buildQrPayload(String issuer, String accountName, String base32Secret) {
        return buildOtpAuthUri(issuer, accountName, base32Secret);
    }

    public static String generateBackupCodes() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 8; i++) {
            if (i > 0) {
                sb.append(",");
            }
            int code = 100000 + random.nextInt(900000);
            sb.append("\"").append(code).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    public static String encodeBase32(byte[] data) {
        StringBuilder result = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                int index = (buffer >> (bitsLeft - 5)) & 0x1F;
                result.append(BASE32_CHARS.charAt(index));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            int index = (buffer << (5 - bitsLeft)) & 0x1F;
            result.append(BASE32_CHARS.charAt(index));
        }
        return result.toString();
    }

    public static byte[] decodeBase32(String base32) {
        base32 = base32.toUpperCase().replaceAll("[^A-Z2-7]", "");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int buffer = 0;
        int bitsLeft = 0;
        for (char c : base32.toCharArray()) {
            int val = BASE32_CHARS.indexOf(c);
            if (val < 0) {
                continue;
            }
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.write((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out.toByteArray();
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    private static final class ByteArrayOutputStream {
        private final java.util.List<Byte> bytes = new java.util.ArrayList<>();

        void write(int b) {
            bytes.add((byte) b);
        }

        byte[] toByteArray() {
            byte[] arr = new byte[bytes.size()];
            for (int i = 0; i < bytes.size(); i++) {
                arr[i] = bytes.get(i);
            }
            return arr;
        }
    }
}
