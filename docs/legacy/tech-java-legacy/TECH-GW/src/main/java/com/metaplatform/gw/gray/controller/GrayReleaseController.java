package com.metaplatform.gw.gray.controller;

import com.metaplatform.gw.common.ApiResponseBody;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.gray.dto.CreateGrayReleaseRequest;
import com.metaplatform.gw.gray.dto.GrayReleaseResponse;
import com.metaplatform.gw.gray.service.GrayReleaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/gw/gray-releases")
@RequiredArgsConstructor
@Slf4j
public class GrayReleaseController {

    private final GrayReleaseService grayReleaseService;

    @PostMapping
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> create(
            @Valid @RequestBody CreateGrayReleaseRequest request) {
        return grayReleaseService.create(request)
                .map(r -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @GetMapping
    public Mono<ApiResponseBody<PageResponse<GrayReleaseResponse>>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId) {
        return grayReleaseService.list(page, size, tenantId)
                .map(ApiResponseBody::success)
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, e -> Mono.just(ApiResponseBody.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> get(@PathVariable UUID id) {
        return grayReleaseService.get(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateGrayReleaseRequest request) {
        return grayReleaseService.update(id, request)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<Void>>> delete(@PathVariable UUID id) {
        return grayReleaseService.delete(id)
                .then(Mono.just(ResponseEntity.ok(ApiResponseBody.<Void>success())))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponseBody.<Void>error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @PostMapping("/{id}/start")
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> start(@PathVariable UUID id) {
        return grayReleaseService.start(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @PostMapping("/{id}/stop")
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> stop(@PathVariable UUID id) {
        return grayReleaseService.stop(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @PostMapping("/{id}/complete")
    public Mono<ResponseEntity<ApiResponseBody<GrayReleaseResponse>>> complete(@PathVariable UUID id) {
        return grayReleaseService.complete(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(GrayReleaseService.GrayReleaseException.class, this::toErrorResponse);
    }

    @ExceptionHandler(GrayReleaseService.GrayReleaseException.class)
    public Mono<ResponseEntity<ApiResponseBody<Void>>> handleException(GrayReleaseService.GrayReleaseException e) {
        ErrorCode errorCode = e.getErrorCode();
        return Mono.just(ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponseBody.<Void>error(errorCode.getCode(), errorCode.getMessage())));
    }

    private <T> Mono<ResponseEntity<ApiResponseBody<T>>> toErrorResponse(GrayReleaseService.GrayReleaseException e) {
        return Mono.just(ResponseEntity.status(e.getErrorCode().getHttpStatus())
                .body(ApiResponseBody.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }
}
