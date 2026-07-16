package com.metaplatform.iam.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;
    private final long refreshExpirationMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs,
            @Value("${app.jwt.refresh-expiration-ms:604800000}") long refreshExpirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public String generateAccessToken(String userId, String username, String tenantId, List<String> roles) {
        return buildToken(userId, username, tenantId, roles, "access", expirationMs);
    }

    public String generateRefreshToken(String userId, String username, String tenantId, List<String> roles) {
        return buildToken(userId, username, tenantId, roles, "refresh", refreshExpirationMs);
    }

    private String buildToken(String userId, String username, String tenantId, List<String> roles, String type, long durationMs) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + durationMs);
        return Jwts.builder()
                .id(java.util.UUID.randomUUID().toString())
                .subject(userId)
                .claim("username", username)
                .claim("tenantId", tenantId)
                .claim("roles", roles != null ? roles : java.util.Collections.emptyList())
                .claim("type", type)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT token expired");
        } catch (UnsupportedJwtException e) {
            log.warn("Unsupported JWT token");
        } catch (MalformedJwtException e) {
            log.warn("Malformed JWT token");
        } catch (SecurityException e) {
            log.warn("Invalid JWT signature");
        } catch (IllegalArgumentException e) {
            log.warn("JWT token is empty or null");
        }
        return false;
    }

    public String getUserId(String token) {
        return parseToken(token).getSubject();
    }

    public String getUsername(String token) {
        return parseToken(token).get("username", String.class);
    }

    public String getTenantId(String token) {
        return parseToken(token).get("tenantId", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRoles(String token) {
        return parseToken(token).get("roles", List.class);
    }

    public long getAccessExpirationSeconds() {
        return expirationMs / 1000;
    }

    public long getRefreshExpirationSeconds() {
        return refreshExpirationMs / 1000;
    }
}
