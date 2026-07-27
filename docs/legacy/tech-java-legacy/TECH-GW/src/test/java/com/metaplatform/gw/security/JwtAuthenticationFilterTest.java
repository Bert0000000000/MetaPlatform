package com.metaplatform.gw.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.WebFilter;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

class JwtAuthenticationFilterTest {

    private WebTestClient webTestClient;
    private SecretKey key;

    private static final String SECRET = "metaplatform-jwt-secret-key-2026";

    @BeforeEach
    void setUp() {
        key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        JwtUtil jwtUtil = new JwtUtil(SECRET);

        WhitelistProperties whitelist = new WhitelistProperties();
        whitelist.setPaths(List.of(
                "/api/v1/iam/auth/login",
                "/api/v1/iam/auth/register",
                "/api/v1/iam/auth/refresh",
                "/api/v1/iam/auth/captcha",
                "/actuator/**",
                "/health/**"
        ));

        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtUtil, whitelist);

        WebFilter webFilter = (exchange, chain) ->
                filter.filter(exchange, ex -> chain.filter(ex));

        webTestClient = WebTestClient.bindToController(new TestController())
                .webFilter(webFilter)
                .build();
    }

    @Test
    void whitelistPath_withoutToken_shouldPass() {
        webTestClient.get()
                .uri("/api/v1/iam/auth/login")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.result").isEqualTo("login-ok");
    }

    @Test
    void nonWhitelistPath_withoutToken_shouldReturn401() {
        webTestClient.get()
                .uri("/api/v1/test/secure")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED)
                .expectBody()
                .jsonPath("$.code").isEqualTo(40101)
                .jsonPath("$.message").isEqualTo("未认证或Token已过期")
                .jsonPath("$.data").isEmpty()
                .jsonPath("$.traceId").isNotEmpty();
    }

    @Test
    void nonWhitelistPath_withValidToken_shouldPassAndPropagateHeaders() {
        String token = generateValidToken("user-123", "testuser", "tenant-default", List.of("admin", "user"));

        webTestClient.get()
                .uri("/api/v1/test/secure")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.userId").isEqualTo("user-123")
                .jsonPath("$.username").isEqualTo("testuser")
                .jsonPath("$.tenantId").isEqualTo("tenant-default")
                .jsonPath("$.roles").isEqualTo("admin,user");
    }

    @Test
    void nonWhitelistPath_withExpiredToken_shouldReturn401() {
        String expiredToken = generateExpiredToken("user-123", "testuser", "tenant-default", List.of("admin"));

        webTestClient.get()
                .uri("/api/v1/test/secure")
                .header("Authorization", "Bearer " + expiredToken)
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED)
                .expectBody()
                .jsonPath("$.code").isEqualTo(40101)
                .jsonPath("$.message").isEqualTo("未认证或Token已过期");
    }

    @Test
    void nonWhitelistPath_withMalformedToken_shouldReturn401() {
        webTestClient.get()
                .uri("/api/v1/test/secure")
                .header("Authorization", "Bearer invalid.malformed.token")
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED)
                .expectBody()
                .jsonPath("$.code").isEqualTo(40101);
    }

    @Test
    void actuatorPath_shouldBeWhitelisted() {
        webTestClient.get()
                .uri("/actuator/health")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.result").isEqualTo("actuator-ok");
    }

    private String generateValidToken(String userId, String username, String tenantId, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + 7200000);
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .claim("tenantId", tenantId)
                .claim("roles", roles)
                .claim("type", "access")
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    private String generateExpiredToken(String userId, String username, String tenantId, List<String> roles) {
        Date past = new Date(System.currentTimeMillis() - 7200000);
        Date expired = new Date(System.currentTimeMillis() - 1000);
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .claim("tenantId", tenantId)
                .claim("roles", roles)
                .claim("type", "access")
                .issuedAt(past)
                .expiration(expired)
                .signWith(key)
                .compact();
    }

    @RestController
    static class TestController {

        @GetMapping("/api/v1/test/secure")
        public Map<String, String> secure(
                @RequestHeader(value = "X-User-Id", required = false) String userId,
                @RequestHeader(value = "X-Username", required = false) String username,
                @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId,
                @RequestHeader(value = "X-Roles", required = false) String roles) {
            return Map.of(
                    "userId", userId != null ? userId : "",
                    "username", username != null ? username : "",
                    "tenantId", tenantId != null ? tenantId : "",
                    "roles", roles != null ? roles : ""
            );
        }

        @GetMapping("/api/v1/iam/auth/login")
        public Map<String, String> login() {
            return Map.of("result", "login-ok");
        }

        @GetMapping("/actuator/health")
        public Map<String, String> actuatorHealth() {
            return Map.of("result", "actuator-ok");
        }
    }
}
