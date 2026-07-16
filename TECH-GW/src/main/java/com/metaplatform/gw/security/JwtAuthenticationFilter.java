package com.metaplatform.gw.security;

import com.metaplatform.gw.common.TraceContext;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private final JwtUtil jwtUtil;
    private final WhitelistProperties whitelistProperties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    private static final String AUTH_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String HEADER_USER_ID = "X-User-Id";
    private static final String HEADER_USERNAME = "X-Username";
    private static final String HEADER_TENANT_ID = "X-Tenant-Id";
    private static final String HEADER_ROLES = "X-Roles";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (isWhitelisted(path)) {
            return chain.filter(exchange);
        }

        String authHeader = request.getHeaders().getFirst(AUTH_HEADER);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return unauthorized(exchange, "未认证或Token已过期");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());
        if (!jwtUtil.validateToken(token)) {
            return unauthorized(exchange, "未认证或Token已过期");
        }

        try {
            Claims claims = jwtUtil.parseToken(token);
            String userId = jwtUtil.getUserId(claims);
            String username = jwtUtil.getUsername(claims);
            String tenantId = jwtUtil.getTenantId(claims);
            String roles = String.join(",", jwtUtil.getRoles(claims));

            ServerHttpRequest mutatedRequest = request.mutate()
                    .header(HEADER_USER_ID, userId != null ? userId : "")
                    .header(HEADER_USERNAME, username != null ? username : "")
                    .header(HEADER_TENANT_ID, tenantId != null ? tenantId : "")
                    .header(HEADER_ROLES, roles)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        } catch (Exception e) {
            log.warn("JWT token parsing failed: {}", e.getMessage());
            return unauthorized(exchange, "未认证或Token已过期");
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    private boolean isWhitelisted(String path) {
        return whitelistProperties.getPaths().stream()
                .anyMatch(pattern -> pathMatcher.match(pattern, path));
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String traceId = TraceContext.getOrCreate();
        String body = "{\"code\":40101,\"message\":\"" + message + "\",\"data\":null,\"traceId\":\"" + traceId + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
