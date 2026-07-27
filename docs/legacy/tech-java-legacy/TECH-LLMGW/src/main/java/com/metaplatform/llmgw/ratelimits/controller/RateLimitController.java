package com.metaplatform.llmgw.ratelimits.controller;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.ratelimits.dto.CreateRateLimitRuleRequest;
import com.metaplatform.llmgw.ratelimits.dto.RateLimitRuleDto;
import com.metaplatform.llmgw.ratelimits.dto.RateLimitStatsDto;
import com.metaplatform.llmgw.ratelimits.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/llmgw/ratelimits")
@RequiredArgsConstructor
public class RateLimitController {

    private final RateLimitService rateLimitService;

    @GetMapping
    public ApiResponse<Page<RateLimitRuleDto>> list(Pageable pageable) {
        return ApiResponse.ok(rateLimitService.listAll(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<RateLimitRuleDto> getById(@PathVariable Long id) {
        return ApiResponse.ok(rateLimitService.getById(id));
    }

    @PostMapping
    public ApiResponse<RateLimitRuleDto> create(@RequestBody CreateRateLimitRuleRequest request) {
        return ApiResponse.ok(rateLimitService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<RateLimitRuleDto> update(@PathVariable Long id, @RequestBody CreateRateLimitRuleRequest request) {
        return ApiResponse.ok(rateLimitService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        rateLimitService.delete(id);
        return ApiResponse.ok(null);
    }

    @GetMapping("/{id}/stats")
    public ApiResponse<RateLimitStatsDto> stats(@PathVariable Long id) {
        return ApiResponse.ok(rateLimitService.getStats(id));
    }

    @PostMapping("/{id}/reset")
    public ApiResponse<Void> reset(@PathVariable Long id) {
        rateLimitService.resetCounters(id);
        return ApiResponse.ok(null);
    }
}
