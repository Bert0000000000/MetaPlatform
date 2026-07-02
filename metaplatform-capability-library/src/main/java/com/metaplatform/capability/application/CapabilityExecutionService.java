package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 能力执行服务。提供统一的能力执行入口，包含日志和监控。
 */
@Service
public class CapabilityExecutionService {

    private static final Logger log = LoggerFactory.getLogger(CapabilityExecutionService.class);

    private final CapabilityRegistry registry;

    public CapabilityExecutionService(CapabilityRegistry registry) {
        this.registry = registry;
    }

    /**
     * 按名称执行单个能力。
     */
    public CapabilityResult execute(String capabilityName, CapabilityContext context) {
        Capability capability = registry.findByName(capabilityName)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Capability not found: " + capabilityName));

        log.info("Executing capability '{}' with params: {}", capabilityName, context.parameters().keySet());

        long startTime = System.currentTimeMillis();
        CapabilityResult result = capability.execute(context);
        long totalTime = System.currentTimeMillis() - startTime;

        log.info("Capability '{}' completed: success={}, time={}ms",
                capabilityName, result.success(), totalTime);

        return new CapabilityResult(result.success(), result.message(), result.data(), totalTime);
    }

    /**
     * 获取所有可用能力列表。
     */
    public List<Capability> listAvailable() {
        return registry.findAll();
    }

    /**
     * 按类型查询能力。
     */
    public List<Capability> listByType(CapabilityType type) {
        return registry.findByType(type);
    }
}
