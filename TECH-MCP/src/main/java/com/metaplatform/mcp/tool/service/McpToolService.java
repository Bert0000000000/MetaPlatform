package com.metaplatform.mcp.tool.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionCompareResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionResponse;
import com.metaplatform.mcp.tool.dto.ToolStatsResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.entity.McpToolVersionEntity;
import com.metaplatform.mcp.tool.repository.McpToolCategoryRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import com.metaplatform.mcp.tool.repository.McpToolVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpToolService {

    private final McpToolRepository mcpToolRepository;
    private final McpToolVersionRepository mcpToolVersionRepository;
    private final McpToolCategoryRepository mcpToolCategoryRepository;
    private final McpAuditLogRepository mcpAuditLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public McpToolResponse create(CreateMcpToolRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "MCP Tool code 在该租户下已存在");
        }
        validateCategory(tenantId, request.getCategory());
        validateJson(request.getInputSchema(), "inputSchema");
        validateJson(request.getOutputSchema(), "outputSchema");

        Instant now = Instant.now();
        String version = "1.0.0";
        McpToolEntity entity = McpToolEntity.builder()
                .tenantId(tenantId)
                .serverId(request.getServerId())
                .name(request.getName())
                .code(request.getCode())
                .category(request.getCategory())
                .version(version)
                .tags(serializeTags(request.getTags()))
                .description(request.getDescription())
                .inputSchema(normalizeJson(request.getInputSchema(), "{}"))
                .outputSchema(normalizeJson(request.getOutputSchema(), "{}"))
                .toolType(StringUtils.hasText(request.getToolType()) ? request.getToolType().toUpperCase() : "CUSTOM")
                .endpoint(request.getEndpoint())
                .beanClass(request.getBeanClass())
                .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                .status("DRAFT")
                .createdAt(now)
                .updatedAt(now)
                .build();
        McpToolEntity saved = mcpToolRepository.save(entity);
        createVersion(saved, version, "初始版本");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<McpToolListItem> list(UUID serverId, String toolType, Boolean enabled,
                                               String keyword, String category, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        List<McpToolEntity> all = mcpToolRepository.search(
                tenantId,
                serverId,
                toolType == null ? null : toolType.toUpperCase(),
                enabled,
                category,
                keyword);

        int start = (int) pageable.getOffset();
        int end = Math.min(start + s, all.size());
        List<McpToolListItem> items = (start <= all.size())
                ? all.subList(start, end).stream().map(this::toListItem).toList()
                : List.of();

        return PageResponse.<McpToolListItem>builder()
                .items(items)
                .total(all.size())
                .page(p)
                .size(s)
                .totalPages(all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / s))
                .build();
    }

    @Transactional(readOnly = true)
    public McpToolResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public McpToolResponse update(UUID id, UpdateMcpToolRequest request) {
        McpToolEntity entity = findById(id);
        String tenantId = TenantContext.getOrDefault();
        validateCategory(tenantId, request.getCategory());

        boolean schemaChanged = false;
        boolean descriptionChanged = false;

        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            if (!request.getDescription().equals(entity.getDescription())) {
                descriptionChanged = true;
            }
            entity.setDescription(request.getDescription());
        }
        if (request.getCategory() != null) {
            entity.setCategory(request.getCategory());
        }
        if (request.getInputSchema() != null) {
            validateJson(request.getInputSchema(), "inputSchema");
            if (!request.getInputSchema().equals(entity.getInputSchema())) {
                schemaChanged = true;
            }
            entity.setInputSchema(request.getInputSchema());
        }
        if (request.getOutputSchema() != null) {
            validateJson(request.getOutputSchema(), "outputSchema");
            entity.setOutputSchema(request.getOutputSchema());
        }
        if (request.getToolType() != null) {
            entity.setToolType(request.getToolType().toUpperCase());
        }
        if (request.getEndpoint() != null) {
            entity.setEndpoint(request.getEndpoint());
        }
        if (request.getBeanClass() != null) {
            entity.setBeanClass(request.getBeanClass());
        }
        if (request.getServerId() != null) {
            entity.setServerId(request.getServerId());
        }
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
        }
        if (request.getTags() != null) {
            entity.setTags(serializeTags(request.getTags()));
        }

        if (schemaChanged || descriptionChanged) {
            String newVersion = bumpVersion(entity.getVersion());
            entity.setVersion(newVersion);
            createVersion(entity, newVersion, request.getChangeLog());
        }

        entity.setUpdatedAt(Instant.now());
        McpToolEntity saved = mcpToolRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        McpToolEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        mcpToolRepository.save(entity);
    }

    @Transactional
    public McpToolResponse enable(UUID id) {
        McpToolEntity entity = findById(id);
        if (Boolean.TRUE.equals(entity.getEnabled())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "Tool 已启用");
        }
        entity.setEnabled(Boolean.TRUE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpToolRepository.save(entity));
    }

    @Transactional
    public McpToolResponse disable(UUID id) {
        McpToolEntity entity = findById(id);
        if (Boolean.FALSE.equals(entity.getEnabled())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "Tool 已禁用");
        }
        entity.setEnabled(Boolean.FALSE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpToolRepository.save(entity));
    }

    @Transactional
    public McpToolResponse publish(UUID id) {
        McpToolEntity entity = findById(id);
        if ("PUBLISHED".equals(entity.getStatus())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "Tool 已发布");
        }
        if (!Boolean.TRUE.equals(entity.getEnabled())) {
            throw new McpException(ErrorCode.TOOL_NOT_ENABLED, "Tool 未启用，无法发布");
        }
        entity.setStatus("PUBLISHED");
        entity.setPublishedAt(Instant.now());
        entity.setPublishedBy(TraceContext.getUserId());
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpToolRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public ToolStatsResponse stats() {
        String tenantId = TenantContext.getOrDefault();
        long total = mcpToolRepository.countByTenantIdAndDeletedAtIsNull(tenantId);
        long enabledCount = mcpToolRepository.countByTenantIdAndEnabledTrueAndDeletedAtIsNull(tenantId);
        long disabledCount = mcpToolRepository.countByTenantIdAndEnabledFalseAndDeletedAtIsNull(tenantId);

        java.util.Map<String, Long> byStatus = new java.util.LinkedHashMap<>();
        for (Object[] row : mcpToolRepository.countByStatus(tenantId)) {
            String status = row[0] == null ? "DRAFT" : (String) row[0];
            byStatus.put(status, (Long) row[1]);
        }

        java.util.Map<String, Long> byCategory = new java.util.LinkedHashMap<>();
        for (Object[] row : mcpToolRepository.countByCategory(tenantId)) {
            String category = row[0] == null ? "uncategorized" : (String) row[0];
            byCategory.put(category, (Long) row[1]);
        }

        Instant sevenDaysAgo = Instant.now().minus(java.time.Duration.ofDays(7));
        java.util.List<ToolStatsResponse.TopTool> topTools = new java.util.ArrayList<>();
        List<Object[]> toolCallCounts = mcpAuditLogRepository.countByTool(tenantId, sevenDaysAgo, null);
        int limit = Math.min(toolCallCounts.size(), 10);
        for (int i = 0; i < limit; i++) {
            Object[] row = toolCallCounts.get(i);
            String toolCode = row[0] == null ? "unknown" : (String) row[0];
            long callCount = (Long) row[1];
            topTools.add(ToolStatsResponse.TopTool.builder()
                    .toolCode(toolCode)
                    .callCount(callCount)
                    .build());
        }

        return ToolStatsResponse.builder()
                .total(total)
                .enabledCount(enabledCount)
                .disabledCount(disabledCount)
                .byStatus(byStatus)
                .byCategory(byCategory)
                .topToolsByCalls7d(topTools)
                .build();
    }

    @Transactional(readOnly = true)
    public List<McpToolVersionResponse> listVersions(UUID toolId) {
        McpToolEntity tool = findById(toolId);
        return mcpToolVersionRepository.findByToolIdAndTenantIdOrderByCreatedAtDesc(tool.getId(), tool.getTenantId())
                .stream().map(this::toVersionResponse).toList();
    }

    @Transactional(readOnly = true)
    public McpToolVersionResponse getVersion(UUID toolId, UUID versionId) {
        McpToolEntity tool = findById(toolId);
        McpToolVersionEntity version = mcpToolVersionRepository.findByIdAndTenantId(versionId, tool.getTenantId())
                .filter(v -> v.getToolId().equals(tool.getId()))
                .orElseThrow(() -> new McpException(ErrorCode.NOT_FOUND, "版本不存在"));
        return toVersionResponse(version);
    }

    @Transactional
    public McpToolVersionResponse rollback(UUID toolId, UUID versionId) {
        return restoreVersion(toolId, versionId);
    }

    @Transactional
    public McpToolVersionResponse setCurrent(UUID toolId, UUID versionId) {
        return restoreVersion(toolId, versionId);
    }

    @Transactional(readOnly = true)
    public McpToolVersionCompareResponse compareVersions(UUID toolId, UUID leftVersionId, UUID rightVersionId) {
        McpToolVersionResponse left = getVersion(toolId, leftVersionId);
        McpToolVersionResponse right = getVersion(toolId, rightVersionId);
        List<String> differences = computeDifferences(left, right);
        return McpToolVersionCompareResponse.builder()
                .left(left)
                .right(right)
                .differences(differences)
                .build();
    }

    @Transactional(readOnly = true)
    public McpToolEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在"));
    }

    @Transactional(readOnly = true)
    public McpToolEntity findByCode(String code) {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, code)
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在: " + code));
    }

    @Transactional(readOnly = true)
    public List<McpToolEntity> listEnabled() {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByTenantIdAndEnabledTrueAndDeletedAtIsNull(tenantId);
    }

    private McpToolVersionResponse restoreVersion(UUID toolId, UUID versionId) {
        McpToolEntity tool = findById(toolId);
        McpToolVersionEntity version = mcpToolVersionRepository.findByIdAndTenantId(versionId, tool.getTenantId())
                .filter(v -> v.getToolId().equals(tool.getId()))
                .orElseThrow(() -> new McpException(ErrorCode.NOT_FOUND, "版本不存在"));

        tool.setInputSchema(version.getSchema());
        tool.setDescription(version.getDescription());
        tool.setVersion(version.getVersion());
        tool.setUpdatedAt(Instant.now());
        mcpToolRepository.save(tool);

        mcpToolVersionRepository.clearCurrentByToolId(tool.getId(), tool.getTenantId());
        version.setIsCurrent(Boolean.TRUE);
        McpToolVersionEntity saved = mcpToolVersionRepository.save(version);
        return toVersionResponse(saved);
    }

    private void createVersion(McpToolEntity tool, String version, String changeLog) {
        mcpToolVersionRepository.clearCurrentByToolId(tool.getId(), tool.getTenantId());
        McpToolVersionEntity versionEntity = McpToolVersionEntity.builder()
                .tenantId(tool.getTenantId())
                .toolId(tool.getId())
                .version(version)
                .schema(tool.getInputSchema())
                .description(tool.getDescription())
                .changeLog(changeLog)
                .isCurrent(Boolean.TRUE)
                .createdAt(Instant.now())
                .createdBy(null)
                .build();
        mcpToolVersionRepository.save(versionEntity);
    }

    private String bumpVersion(String current) {
        if (!StringUtils.hasText(current)) {
            return "1.0.0";
        }
        String[] parts = current.split("\\.");
        if (parts.length == 3) {
            try {
                int major = Integer.parseInt(parts[0]);
                int minor = Integer.parseInt(parts[1]);
                int patch = Integer.parseInt(parts[2]);
                return major + "." + minor + "." + (patch + 1);
            } catch (NumberFormatException ignored) {
            }
        }
        return current + ".1";
    }

    private void validateCategory(String tenantId, String category) {
        if (!StringUtils.hasText(category)) {
            return;
        }
        if (!mcpToolCategoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, category)) {
            throw new McpException(ErrorCode.TOOL_CATEGORY_NOT_FOUND, "工具分类不存在: " + category);
        }
    }

    private List<String> computeDifferences(McpToolVersionResponse left, McpToolVersionResponse right) {
        List<String> diffs = new ArrayList<>();
        if (!java.util.Objects.equals(left.getDescription(), right.getDescription())) {
            diffs.add("description");
        }
        if (!java.util.Objects.equals(left.getSchema(), right.getSchema())) {
            diffs.add("schema");
        }
        if (!java.util.Objects.equals(left.getChangeLog(), right.getChangeLog())) {
            diffs.add("changeLog");
        }
        return diffs;
    }

    private McpToolResponse toResponse(McpToolEntity entity) {
        return McpToolResponse.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .name(entity.getName())
                .code(entity.getCode())
                .category(entity.getCategory())
                .version(entity.getVersion())
                .description(entity.getDescription())
                .inputSchema(entity.getInputSchema())
                .outputSchema(entity.getOutputSchema())
                .toolType(entity.getToolType())
                .endpoint(entity.getEndpoint())
                .beanClass(entity.getBeanClass())
                .enabled(entity.getEnabled())
                .status(entity.getStatus())
                .publishedAt(entity.getPublishedAt())
                .publishedBy(entity.getPublishedBy())
                .tags(parseTags(entity.getTags()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpToolListItem toListItem(McpToolEntity entity) {
        return McpToolListItem.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .name(entity.getName())
                .code(entity.getCode())
                .category(entity.getCategory())
                .version(entity.getVersion())
                .description(entity.getDescription())
                .inputSchema(entity.getInputSchema())
                .toolType(entity.getToolType())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpToolVersionResponse toVersionResponse(McpToolVersionEntity entity) {
        return McpToolVersionResponse.builder()
                .id(entity.getId())
                .toolId(entity.getToolId())
                .version(entity.getVersion())
                .schema(entity.getSchema())
                .description(entity.getDescription())
                .changeLog(entity.getChangeLog())
                .isCurrent(entity.getIsCurrent())
                .createdAt(entity.getCreatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }

    private String serializeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(tags);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, "tags 序列化失败");
        }
    }

    private List<String> parseTags(String tags) {
        if (!StringUtils.hasText(tags)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(tags, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return List.of();
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
