package com.metaplatform.llmgw.routing;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.routing.dto.CreateRoutingRuleRequest;
import com.metaplatform.llmgw.routing.dto.RoutingRecommendRequest;
import com.metaplatform.llmgw.routing.dto.RoutingRuleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/llmgw/routing")
@RequiredArgsConstructor
public class RoutingController {

    private final RoutingService routingService;

    @GetMapping("/rules")
    public ApiResponse<List<RoutingRuleDto>> listRules() {
        return ApiResponse.ok(routingService.listRules(false));
    }

    @GetMapping("/rules/{id}")
    public ApiResponse<RoutingRuleDto> getRule(@PathVariable Long id) {
        return ApiResponse.ok(routingService.getRule(id));
    }

    @PostMapping("/rules")
    public ApiResponse<RoutingRuleDto> createRule(@RequestBody CreateRoutingRuleRequest request) {
        return ApiResponse.ok(routingService.createRule(request));
    }

    @PutMapping("/rules/{id}")
    public ApiResponse<RoutingRuleDto> updateRule(@PathVariable Long id, @RequestBody CreateRoutingRuleRequest request) {
        return ApiResponse.ok(routingService.updateRule(id, request));
    }

    @DeleteMapping("/rules/{id}")
    public ApiResponse<Void> deleteRule(@PathVariable Long id) {
        routingService.deleteRule(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/recommend")
    public ApiResponse<Map<String, String>> recommend(@RequestBody RoutingRecommendRequest request) {
        String model = routingService.selectModel(request.taskType(), request.userId(), request.appId());
        Map<String, String> result = new java.util.HashMap<>();
        result.put("targetModel", model);
        return ApiResponse.ok(result);
    }
}
