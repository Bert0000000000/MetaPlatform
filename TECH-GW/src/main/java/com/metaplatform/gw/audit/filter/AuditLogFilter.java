package com.metaplatform.gw.audit.filter;

import com.metaplatform.gw.audit.dto.RecordAuditLogRequest;
import com.metaplatform.gw.audit.service.AuditLogService;
import com.metaplatform.gw.common.TraceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.time.Duration;

/**
 * Records every proxied request/response into the audit log. Runs after authentication
 * (so the JWT-populated user/tenant headers are visible) but with low priority so it
 * always wraps the outbound chain.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogFilter implements GlobalFilter, Ordered {

    private final AuditLogService auditLogService;

    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_TENANT_ID = "X-Tenant-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startNs = System.nanoTime();
        ServerHttpRequest request = exchange.getRequest();
        ServerHttpResponse response = exchange.getResponse();

        long requestSize = request.getHeaders().getContentLength() > 0
                ? request.getHeaders().getContentLength()
                : 0L;

        ServerHttpResponseDecorator decorated = new ServerHttpResponseDecorator(response) {
            @Override
            public Mono<Void> writeWith(org.reactivestreams.Publisher<? extends DataBuffer> body) {
                return super.writeWith(Flux.from(body)
                        .collectList()
                        .flatMapMany(buffers -> {
                            long responseSize = buffers.stream()
                                    .mapToLong(DataBuffer::readableByteCount)
                                    .sum();
                            long durationMs = Duration.ofNanos(System.nanoTime() - startNs).toMillis();
                            record(exchange, request, response, requestSize, responseSize, durationMs, null);
                            return Flux.fromIterable(buffers)
                                    .doFinally(s -> DataBufferUtils.release(buffers.get(buffers.size() - 1)));
                        }));
            }
        };

        return chain.filter(exchange.mutate().response(decorated).build())
                .onErrorResume(err -> {
                    long durationMs = Duration.ofNanos(System.nanoTime() - startNs).toMillis();
                    record(exchange, request, response, requestSize, 0L, durationMs, err.getMessage());
                    return Mono.error(err);
                });
    }

    private void record(ServerWebExchange exchange,
                        ServerHttpRequest request,
                        ServerHttpResponse response,
                        long requestSize,
                        long responseSize,
                        long durationMs,
                        String errorMessage) {
        try {
            Integer statusCode = response.getStatusCode() != null ? response.getStatusCode().value() : null;
            boolean isError = response.getStatusCode() != null && response.getStatusCode().isError();
            if (errorMessage != null) {
                isError = true;
                statusCode = statusCode != null ? statusCode : HttpStatus.INTERNAL_SERVER_ERROR.value();
            }

            String path = request.getURI().getPath();
            if (path.startsWith("/api/v1/gw/audit-logs") || path.startsWith("/api/v1/gw/audit-alerts")) {
                return;
            }
            String userId = request.getHeaders().getFirst(HEADER_USER_ID);
            String tenantId = request.getHeaders().getFirst(HEADER_TENANT_ID);
            String traceId = TraceContext.getOrCreate();
            InetSocketAddress remote = request.getRemoteAddress();
            String clientIp = remote != null && remote.getAddress() != null
                    ? remote.getAddress().getHostAddress() : null;
            String method = request.getMethod().name();

            RecordAuditLogRequest recordRequest = RecordAuditLogRequest.builder()
                    .tenantId(tenantId)
                    .path(path)
                    .method(method)
                    .statusCode(statusCode)
                    .requestSize(requestSize)
                    .responseSize(responseSize)
                    .durationMs(durationMs)
                    .userId(userId)
                    .traceId(traceId)
                    .clientIp(clientIp)
                    .errorMessage(errorMessage)
                    .isError(isError)
                    .build();

            auditLogService.record(recordRequest).subscribe();
        } catch (Exception e) {
            log.warn("Failed to record audit log: {}", e.getMessage());
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
