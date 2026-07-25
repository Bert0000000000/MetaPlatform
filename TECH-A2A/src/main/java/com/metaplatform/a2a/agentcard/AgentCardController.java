package com.metaplatform.a2a.agentcard;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Agent Card 管理端点。
 *
 * <p>对应 Python {@code app.api.v1.agent_cards}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/agent-cards")
@RequiredArgsConstructor
public class AgentCardController {

    private final AgentCardService cardService;

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody AgentCardRequest request) {
        Map<String, Object> result = cardService.create(
                TenantContext.getTenantIdOrDefault(), request, TenantContext.getUserId());
        return ApiResponse.success(result);
    }

    @GetMapping
    public ApiResponse<PageResponse<Map<String, Object>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<Map<String, Object>> result = cardService.list(
                TenantContext.getTenantIdOrDefault(), status, page, pageSize);
        return ApiResponse.success(result);
    }

    @GetMapping("/{cardId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable String cardId) {
        return ApiResponse.success(cardService.get(
                TenantContext.getTenantIdOrDefault(), cardId));
    }

    @PutMapping("/{cardId}")
    public ApiResponse<Map<String, Object>> update(
            @PathVariable String cardId,
            @Valid @RequestBody AgentCardRequest request) {
        return ApiResponse.success(cardService.update(
                TenantContext.getTenantIdOrDefault(), cardId, request, TenantContext.getUserId()));
    }

    @DeleteMapping("/{cardId}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String cardId) {
        boolean ok = cardService.delete(
                TenantContext.getTenantIdOrDefault(), cardId, TenantContext.getUserId());
        return ApiResponse.success(Map.of("deleted", ok, "cardId", cardId));
    }
}
