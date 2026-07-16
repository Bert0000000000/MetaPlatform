package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 能力注册表。管理所有已注册的能力，支持按名称查找和按类型过滤。
 */
@Service
public class CapabilityRegistry {

    private static final Logger log = LoggerFactory.getLogger(CapabilityRegistry.class);

    private final Map<String, Capability> capabilities = new ConcurrentHashMap<>();

    /**
     * 通过 Spring 自动注入所有 Capability Bean 进行注册。
     */
    public CapabilityRegistry(List<Capability> capabilityBeans) {
        for (Capability cap : capabilityBeans) {
            register(cap);
        }
        log.info("Registered {} capabilities: {}", capabilities.size(), capabilities.keySet());
    }

    /**
     * 注册一个能力。
     */
    public void register(Capability capability) {
        capabilities.put(capability.name(), capability);
    }

    /**
     * 按名称查找能力。
     */
    public Optional<Capability> findByName(String name) {
        return Optional.ofNullable(capabilities.get(name));
    }

    /**
     * 获取所有已注册的能力。
     */
    public List<Capability> findAll() {
        return List.copyOf(capabilities.values());
    }

    /**
     * 按类型过滤能力。
     */
    public List<Capability> findByType(CapabilityType type) {
        return capabilities.values().stream()
                .filter(c -> c.type() == type)
                .toList();
    }

    /**
     * 获取已注册的能力数量。
     */
    public int count() {
        return capabilities.size();
    }

    /**
     * 检查能力是否已注册。
     */
    public boolean contains(String name) {
        return capabilities.containsKey(name);
    }
}
