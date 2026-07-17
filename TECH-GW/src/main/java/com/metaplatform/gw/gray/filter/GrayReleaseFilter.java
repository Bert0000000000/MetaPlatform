package com.metaplatform.gw.gray.filter;

import com.metaplatform.gw.api.entity.GwApiEntity;
import com.metaplatform.gw.api.repository.GwApiRepository;
import com.metaplatform.gw.gray.entity.GwGrayReleaseEntity;
import com.metaplatform.gw.gray.service.GrayReleaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Optional;

/**
 * Global filter that matches the incoming path/method against the API catalog and resolves an
 * active gray release. When matched, we attach {@code X-Gray-Release-Id} and
 * {@code X-Gray-Target-Version} headers to the request so upstream routing logic can choose
 * between old and new versions.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GrayReleaseFilter implements GlobalFilter, Ordered {

    private final GwApiRepository apiRepository;
    private final GrayReleaseService grayReleaseService;

    public static final String HEADER_GRAY_RELEASE_ID = "X-Gray-Release-Id";
    public static final String HEADER_GRAY_TARGET_VERSION = "X-Gray-Target-Version";
    private static final String DEFAULT_TENANT = "tenant-default";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        String method = request.getMethod().name();

        if (path.startsWith("/api/v1/gw/") || path.equals("/health") || path.startsWith("/health/")) {
            return chain.filter(exchange);
        }

        return Mono.fromCallable(() -> apiRepository
                        .searchApis(DEFAULT_TENANT, null, null, null, PageRequest.of(0, 200))
                        .getContent().stream()
                        .filter(api -> matchPath(path, api.getPath())
                                && method.equalsIgnoreCase(api.getMethod()))
                        .findFirst())
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(maybeApi -> maybeApi
                        .map(api -> applyGray(exchange, chain, request, path, method, api))
                        .orElseGet(() -> chain.filter(exchange)));
    }

    private Mono<Void> applyGray(ServerWebExchange exchange, GatewayFilterChain chain,
                                 ServerHttpRequest request, String path, String method,
                                 GwApiEntity api) {
        Optional<GwGrayReleaseEntity> match = grayReleaseService.matchRequest(api.getId(), request);
        if (match.isEmpty()) {
            return chain.filter(exchange);
        }
        GwGrayReleaseEntity release = match.get();
        ServerHttpRequest mutated = request.mutate()
                .header(HEADER_GRAY_RELEASE_ID, release.getId().toString())
                .header(HEADER_GRAY_TARGET_VERSION,
                        release.getNewVersion() != null ? release.getNewVersion() : "new")
                .build();
        log.debug("Gray release {} matched for {} {}", release.getId(), method, path);
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    private boolean matchPath(String requestPath, String apiPath) {
        if (apiPath == null) return false;
        if (apiPath.endsWith("/**")) {
            return requestPath.startsWith(apiPath.substring(0, apiPath.length() - 3));
        }
        return apiPath.equals(requestPath);
    }

    @Override
    public int getOrder() {
        // Run after JWT filter so user/tenant context is established.
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }
}
