package com.metaplatform.iam.util;

import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil(
            "mate-platform-test-secret-key-must-be-over-32-bytes",
            7200000L,
            604800000L
    );

    @Test
    void generateAndParseAccessToken_shouldWork() {
        String token = jwtUtil.generateAccessToken("user-9a8b7c6d", "alice", "tenant-default", Collections.singletonList("USER"));
        assertThat(token).isNotBlank();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getUserId(token)).isEqualTo("user-9a8b7c6d");
        assertThat(jwtUtil.getUsername(token)).isEqualTo("alice");
        assertThat(jwtUtil.getTenantId(token)).isEqualTo("tenant-default");
    }

    @Test
    void generateAndParseRefreshToken_shouldWork() {
        String token = jwtUtil.generateRefreshToken("user-9a8b7c6d", "alice", "tenant-default", Collections.singletonList("USER"));
        assertThat(token).isNotBlank();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getUserId(token)).isEqualTo("user-9a8b7c6d");
    }

    @Test
    void validateToken_shouldReturnFalse_forInvalidToken() {
        assertThat(jwtUtil.validateToken("invalid.token.here")).isFalse();
    }
}
