package com.metaplatform.gw.ratelimit.controller;

import com.metaplatform.gw.common.ApiResponse;
import com.metaplatform.gw.common.ErrorCode;
import com.metaplatform.gw.common.PageResponse;
import com.metaplatform.gw.ratelimit.dto.*;
import com.metaplatform.gw.ratelimit.service.RateLimitRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/gw/rate-limits")
@RequiredArgsConstructor
@Slf4j
public class RateLimitRuleController {

    private final RateLimitRuleService rateLimitService;

    @PostMapping
    public Mono<ResponseEntity<ApiResponse<RateLimitResponse>>> createRule(
            @Valid @RequestBody CreateRateLimitRequest request) {
        return rateLimitService.createRule(request)
                .map(response -> ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @GetMapping
    public Mono<ApiResponse<PageResponse<RateLimitListItemResponse>>> listRules(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String routeId,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String limitType) {
        return rateLimitService.listRules(page, pageSize, sort, keyword, status, routeId, scope, limitType)
                .map(ApiResponse::success)
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> Mono.just(ApiResponse.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/stats")
    public Mono<ApiResponse<RateLimitStatsResponse>> getStats(
            @RequestParam String startTime,
            @RequestParam String endTime,
            @RequestParam(required = false) String routeId,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String limitType,
            @RequestParam(required = false, defaultValue = "HOUR") String granularity) {
        return rateLimitService.getStats(startTime, endTime, routeId, scope, limitType, granularity)
                .map(ApiResponse::success)
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> Mono.just(ApiResponse.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @GetMapping("/{ruleId}")
    public Mono<ResponseEntity<ApiResponse<RateLimitResponse>>> getRule(@PathVariable String ruleId) {
        return rateLimitService.getRule(ruleId)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @PutMapping("/{ruleId}")
    public Mono<ResponseEntity<ApiResponse<RateLimitResponse>>> updateRule(
            @PathVariable String ruleId,
            @Valid @RequestBody UpdateRateLimitRequest request) {
        return rateLimitService.updateRule(ruleId, request)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @DeleteMapping("/{ruleId}")
    public Mono<ResponseEntity<ApiResponse<RateLimitDeleteResponse>>> deleteRule(
            @PathVariable String ruleId,
            @RequestParam(required = false) String reason) {
        return rateLimitService.deleteRule(ruleId, reason)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @PutMapping("/{ruleId}/state")
    public Mono<ResponseEntity<ApiResponse<RateLimitStateResponse>>> updateState(
            @PathVariable String ruleId,
            @Valid @RequestBody RateLimitStateRequest request) {
        return rateLimitService.updateState(ruleId, request)
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @PutMapping("/{ruleId}/reset")
    public Mono<ResponseEntity<ApiResponse<RateLimitResetResponse>>> resetCounters(
            @PathVariable String ruleId,
            @RequestBody RateLimitResetRequest request) {
        return rateLimitService.resetCounters(ruleId, request != null ? request : new RateLimitResetRequest())
                .map(response -> ResponseEntity.ok(ApiResponse.success(response)))
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> errorResponse(e));
    }

    @GetMapping("/{ruleId}/stats")
    public Mono<ApiResponse<RateLimitRuleStatsResponse>> getRuleStats(
            @PathVariable String ruleId,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false, defaultValue = "HOUR") String granularity) {
        return rateLimitService.getRuleStats(ruleId, startTime, endTime, granularity)
                .map(ApiResponse::success)
                .onErrorResume(RateLimitRuleService.RateLimitException.class, e -> Mono.just(ApiResponse.error(
                        e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }

    @ExceptionHandler(RateLimitRuleService.RateLimitException.class)
    public Mono<ResponseEntity<ApiResponse<Void>>> handleRateLimitException(RateLimitRuleService.RateLimitException e) {
        ErrorCode errorCode = e.getErrorCode();
        return Mono.just(ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.<Void>error(errorCode.getCode(), errorCode.getMessage())));
    }

    private <T> Mono<ResponseEntity<ApiResponse<T>>> errorResponse(RateLimitRuleService.RateLimitException e) {
        HttpStatus status = e.getErrorCode().getHttpStatus();
        return Mono.just(ResponseEntity.status(status)
                .body(ApiResponse.error(e.getErrorCode().getCode(), e.getErrorCode().getMessage())));
    }
}
