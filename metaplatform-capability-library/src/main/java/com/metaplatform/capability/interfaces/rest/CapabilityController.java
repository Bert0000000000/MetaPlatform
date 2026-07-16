package com.metaplatform.capability.interfaces.rest;

import com.metaplatform.capability.application.CapabilityExecutionService;
import com.metaplatform.capability.application.CapabilityRegistry;
import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import com.metaplatform.capability.interfaces.rest.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 能力 REST 控制器。提供能力查询和执行的 API。
 */
@RestController
@RequestMapping("/api/v1/capabilities")
public class CapabilityController {

    private static final Logger log = LoggerFactory.getLogger(CapabilityController.class);

    private final CapabilityRegistry registry;
    private final CapabilityExecutionService executionService;

    public CapabilityController(CapabilityRegistry registry,
                                CapabilityExecutionService executionService) {
        this.registry = registry;
        this.executionService = executionService;
    }

    /**
     * GET /api/v1/capabilities - 获取所有能力
     */
    @GetMapping
    public ResponseEntity<List<CapabilityResponse>> listCapabilities(
            @RequestParam(required = false) CapabilityType type) {
        List<Capability> capabilities;
        if (type != null) {
            capabilities = registry.findByType(type);
        } else {
            capabilities = registry.findAll();
        }
        return ResponseEntity.ok(capabilities.stream()
                .map(CapabilityResponse::from)
                .toList());
    }

    /**
     * GET /api/v1/capabilities/{name} - 获取能力详情
     */
    @GetMapping("/{name}")
    public ResponseEntity<CapabilityResponse> getCapability(@PathVariable String name) {
        return registry.findByName(name)
                .map(c -> ResponseEntity.ok(CapabilityResponse.from(c)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * POST /api/v1/capabilities/execute - 执行能力
     */
    @PostMapping("/execute")
    public ResponseEntity<ExecuteCapabilityResponse> execute(
            @RequestBody ExecuteCapabilityRequest request) {
        try {
            CapabilityContext context = CapabilityContext.of(request.parameters());
            CapabilityResult result = executionService.execute(request.capabilityName(), context);
            return ResponseEntity.ok(ExecuteCapabilityResponse.from(result));
        } catch (IllegalArgumentException e) {
            log.warn("Execute failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/v1/capabilities/count - 获取能力总数
     */
    @GetMapping("/count")
    public ResponseEntity<Map<String, Integer>> count() {
        return ResponseEntity.ok(Map.of("count", registry.count()));
    }
}
