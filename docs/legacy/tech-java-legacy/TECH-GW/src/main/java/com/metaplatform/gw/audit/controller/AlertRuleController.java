package com.metaplatform.gw.audit.controller;

import com.metaplatform.gw.audit.dto.AlertRuleResponse;
import com.metaplatform.gw.audit.dto.CreateAlertRuleRequest;
import com.metaplatform.gw.audit.service.AlertRuleService;
import com.metaplatform.gw.common.ApiResponseBody;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/gw/audit-alerts/rules")
@RequiredArgsConstructor
@Slf4j
public class AlertRuleController {

    private final AlertRuleService alertRuleService;

    @PostMapping
    public Mono<ResponseEntity<ApiResponseBody<AlertRuleResponse>>> create(
            @Valid @RequestBody CreateAlertRuleRequest request) {
        return alertRuleService.create(request)
                .map(r -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponseBody.success(r)))
                .onErrorResume(AlertRuleService.AlertRuleException.class, this::toErrorResponse);
    }

    @GetMapping
    public Mono<ApiResponseBody<PageResponse<AlertRuleResponse>>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId) {
        return alertRuleService.list(page, size, tenantId)
                .map(ApiResponseBody::success)
                .onErrorResume(AlertRuleService.AlertRuleException.class, e -> Mono.just(ApiResponseBody.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<AlertRuleResponse>>> get(@PathVariable UUID id) {
        return alertRuleService.get(id)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(AlertRuleService.AlertRuleException.class, this::toErrorResponse);
    }

    @PutMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<AlertRuleResponse>>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateAlertRuleRequest request) {
        return alertRuleService.update(id, request)
                .map(r -> ResponseEntity.ok(ApiResponseBody.success(r)))
                .onErrorResume(AlertRuleService.AlertRuleException.class, this::toErrorResponse);
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<ApiResponseBody<Void>>> delete(@PathVariable UUID id) {
        return alertRuleService.delete(id)
                .then(Mono.just(ResponseEntity.ok(ApiResponseBody.<Void>success())))
                .onErrorResume(AlertRuleService.AlertRuleException.class, e -> {
                    HttpStatus status = e.getErrorCode().getHttpStatus();
                    return Mono.just(ResponseEntity.status(status)
                            .body(ApiResponseBody.<Void>error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
                });
    }

    @ExceptionHandler(AlertRuleService.AlertRuleException.class)
    public Mono<ResponseEntity<ApiResponseBody<Void>>> handleException(AlertRuleService.AlertRuleException e) {
        ErrorCode errorCode = e.getErrorCode();
        return Mono.just(ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponseBody.<Void>error(errorCode.getCode(), errorCode.getMessage())));
    }

    private <T> Mono<ResponseEntity<ApiResponseBody<T>>> toErrorResponse(AlertRuleService.AlertRuleException e) {
        return Mono.just(ResponseEntity.status(e.getErrorCode().getHttpStatus())
                .body(ApiResponseBody.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }
}
