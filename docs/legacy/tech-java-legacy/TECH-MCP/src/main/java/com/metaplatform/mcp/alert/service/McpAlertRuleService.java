package com.metaplatform.mcp.alert.service;

import com.metaplatform.mcp.alert.dto.AlertRuleResponse;
import com.metaplatform.mcp.alert.dto.CreateAlertRuleRequest;
import com.metaplatform.mcp.alert.dto.UpdateAlertRuleRequest;
import com.metaplatform.mcp.alert.entity.McpAlertRuleEntity;
import com.metaplatform.mcp.alert.repository.McpAlertRuleRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class McpAlertRuleService {

    private static final int MAX_PAGE_SIZE = 100;

    private final McpAlertRuleRepository repository;

    @Transactional
    public AlertRuleResponse create(CreateAlertRuleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        Instant now = Instant.now();
        McpAlertRuleEntity entity = McpAlertRuleEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .metric(request.getMetric())
                .threshold(request.getThreshold())
                .windowMinutes(request.getWindowMinutes())
                .enabled(request.getEnabled())
                .notifyChannels(join(request.getNotifyChannels()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional
    public AlertRuleResponse update(UUID id, UpdateAlertRuleRequest request) {
        McpAlertRuleEntity entity = find(id);
        entity.setName(request.getName());
        entity.setMetric(request.getMetric());
        entity.setThreshold(request.getThreshold());
        entity.setWindowMinutes(request.getWindowMinutes());
        entity.setEnabled(request.getEnabled());
        entity.setNotifyChannels(join(request.getNotifyChannels()));
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        McpAlertRuleEntity entity = find(id);
        repository.delete(entity);
    }

    @Transactional
    public AlertRuleResponse toggle(UUID id, boolean enabled) {
        McpAlertRuleEntity entity = find(id);
        entity.setEnabled(enabled);
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public AlertRuleResponse get(UUID id) {
        return toResponse(find(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<AlertRuleResponse> list(Boolean enabled, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<McpAlertRuleEntity> result = repository.search(tenantId, enabled, pageable);
        return PageResponse.<AlertRuleResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    private McpAlertRuleEntity find(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.ALERT_RULE_NOT_FOUND, "告警规则不存在"));
    }

    private AlertRuleResponse toResponse(McpAlertRuleEntity entity) {
        return AlertRuleResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .metric(entity.getMetric())
                .threshold(entity.getThreshold())
                .windowMinutes(entity.getWindowMinutes())
                .enabled(entity.getEnabled())
                .notifyChannels(split(entity.getNotifyChannels()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String join(List<String> channels) {
        if (channels == null || channels.isEmpty()) {
            return null;
        }
        return channels.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(","));
    }

    private List<String> split(String channels) {
        if (channels == null || channels.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(channels.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
