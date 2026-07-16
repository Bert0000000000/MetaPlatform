package com.metaplatform.gw.route.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.route.dto.CreateRouteRequest;
import com.metaplatform.gw.route.dto.RouteResponse;
import com.metaplatform.gw.route.dto.UpdateRouteRequest;
import com.metaplatform.gw.route.entity.GwRouteEntity;
import com.metaplatform.gw.route.repository.GwRouteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.event.RefreshRoutesEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GwRouteService {

    private final GwRouteRepository routeRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String DEFAULT_TENANT = "tenant-default";

    public Mono<RouteResponse> createRoute(CreateRouteRequest request) {
        return Mono.fromCallable(() -> {
            String tenantId = request.getTenantId() != null ? request.getTenantId() : DEFAULT_TENANT;

            if (routeRepository.existsByTenantIdAndRouteId(tenantId, request.getRouteId())) {
                throw new RouteException(ErrorCode.ROUTE_ALREADY_EXISTS);
            }

            GwRouteEntity entity = GwRouteEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .routeId(request.getRouteId())
                    .name(request.getName())
                    .uri(request.getUri())
                    .predicates(toJson(request.getPredicates()))
                    .filters(toJson(request.getFilters()))
                    .priority(request.getPriority() != null ? request.getPriority() : 0)
                    .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            entity = routeRepository.save(entity);
            return RouteResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<PageResponse<RouteResponse>> listRoutes(int page, int size, String tenantId) {
        return Mono.fromCallable(() -> {
            String tid = tenantId != null ? tenantId : DEFAULT_TENANT;
            PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "priority", "createdAt"));
            Page<GwRouteEntity> entityPage = routeRepository.findByTenantIdOrderByPriorityDescCreatedAtDesc(tid, pageable);

            List<RouteResponse> items = entityPage.getContent().stream()
                    .map(RouteResponse::fromEntity)
                    .toList();

            return PageResponse.<RouteResponse>builder()
                    .items(items)
                    .total(entityPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(entityPage.getTotalPages())
                    .build();
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RouteResponse> getRoute(String id) {
        return Mono.fromCallable(() -> {
            GwRouteEntity entity = routeRepository.findById(id)
                    .orElseThrow(() -> new RouteException(ErrorCode.ROUTE_NOT_FOUND));
            return RouteResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<RouteResponse> updateRoute(String id, UpdateRouteRequest request) {
        return Mono.fromCallable(() -> {
            GwRouteEntity entity = routeRepository.findById(id)
                    .orElseThrow(() -> new RouteException(ErrorCode.ROUTE_NOT_FOUND));

            if (request.getName() != null) entity.setName(request.getName());
            if (request.getUri() != null) entity.setUri(request.getUri());
            if (request.getPredicates() != null) entity.setPredicates(toJson(request.getPredicates()));
            if (request.getFilters() != null) entity.setFilters(toJson(request.getFilters()));
            if (request.getPriority() != null) entity.setPriority(request.getPriority());
            if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());
            entity.setUpdatedAt(LocalDateTime.now());

            entity = routeRepository.save(entity);
            return RouteResponse.fromEntity(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> deleteRoute(String id) {
        return Mono.fromRunnable(() -> {
            if (!routeRepository.existsById(id)) {
                throw new RouteException(ErrorCode.ROUTE_NOT_FOUND);
            }
            routeRepository.deleteById(id);
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    public Mono<Void> refreshRoutes() {
        return Mono.fromRunnable(() -> {
            eventPublisher.publishEvent(new RefreshRoutesEvent(this));
            log.info("Gateway routes refresh event published");
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    private String toJson(List<?> list) {
        if (list == null || list.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize to JSON", e);
            return "[]";
        }
    }

    public static class RouteException extends RuntimeException {
        private final ErrorCode errorCode;

        public RouteException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public ErrorCode getErrorCode() {
            return errorCode;
        }
    }
}
