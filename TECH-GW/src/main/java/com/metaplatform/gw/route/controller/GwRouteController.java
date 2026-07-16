package com.metaplatform.gw.route.controller;

import com.metaplatform.gw.common.ApiResponse;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.route.dto.CreateRouteRequest;
import com.metaplatform.gw.route.dto.RouteResponse;
import com.metaplatform.gw.route.dto.UpdateRouteRequest;
import com.metaplatform.gw.route.service.GwRouteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/gw/routes")
@RequiredArgsConstructor
@Slf4j
public class GwRouteController {

    private final GwRouteService routeService;

    @PostMapping
    public Mono<ResponseEntity<ApiResponse<RouteResponse>>> createRoute(@Valid @RequestBody CreateRouteRequest request) {
        return routeService.createRoute(request)
                .map(response -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response)))
                .onErrorResume(GwRouteService.RouteException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponse.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @GetMapping
    public Mono<ApiResponse<PageResponse<RouteResponse>>> listRoutes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId) {
        return routeService.listRoutes(page, size, tenantId)
                .map(ApiResponse::success);
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ApiResponse<RouteResponse>>> getRoute(@PathVariable String id) {
        return routeService.getRoute(id)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(GwRouteService.RouteException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponse.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<ApiResponse<RouteResponse>>> updateRoute(
            @PathVariable String id,
            @Valid @RequestBody UpdateRouteRequest request) {
        return routeService.updateRoute(id, request)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(GwRouteService.RouteException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponse.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<ApiResponse<Void>>> deleteRoute(@PathVariable String id) {
        return routeService.deleteRoute(id)
                .then(Mono.just(ResponseEntity.ok(ApiResponse.<Void>success())))
                .onErrorResume(GwRouteService.RouteException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponse.<Void>error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @PostMapping("/{id}/refresh")
    public Mono<ApiResponse<Void>> refreshRoutes(@PathVariable String id) {
        return routeService.refreshRoutes()
                .then(Mono.fromSupplier(() -> ApiResponse.<Void>success()));
    }

    @ExceptionHandler(GwRouteService.RouteException.class)
    public Mono<ResponseEntity<ApiResponse<Void>>> handleRouteException(GwRouteService.RouteException e) {
        ErrorCode errorCode = e.getErrorCode();
        return Mono.just(ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.<Void>error(errorCode.getCode(), errorCode.getMessage())));
    }
}
