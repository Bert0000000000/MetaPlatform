package com.metaplatform.agent.agents;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.agents.dto.AgentOperationLogResponse;
import com.metaplatform.agent.agents.dto.AgentResponse;
import com.metaplatform.agent.agents.dto.AgentVersionResponse;
import com.metaplatform.agent.agents.dto.CloneAgentRequest;
import com.metaplatform.agent.agents.dto.CreateAgentRequest;
import com.metaplatform.agent.agents.dto.UpdateAgentRequest;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.entity.AgentDefinitionEntity;
import com.metaplatform.agent.entity.AgentOperationLogEntity;
import com.metaplatform.agent.entity.AgentVersionEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.repository.AgentDefinitionRepository;
import com.metaplatform.agent.repository.AgentOperationLogRepository;
import com.metaplatform.agent.repository.AgentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Agent 定义服务：CRUD + 版本快照 + 操作审计日志。
 *
 * <p>对应 Python {@code app.agents.service.AgentService}。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final Set<String> ALLOWED_STATUS = Set.of("DRAFT", "ACTIVE", "DISABLED");

    private final AgentDefinitionRepository agentRepository;
    private final AgentVersionRepository versionRepository;
    private final AgentOperationLogRepository logRepository;
    private final ObjectMapper objectMapper;

    // =====================================================================
    // CRUD
    // =====================================================================

    /**
     * 创建 Agent。
     */
    @Transactional
    public AgentResponse create(String tenantId, CreateAgentRequest request, String createdBy) {
        // 校验状态合法性
        validateStatus(request.getStatus());

        // code 租户内唯一
        if (agentRepository.existsByTenantIdAndAgentCode(tenantId, request.getCode())) {
            throw AgentException.duplicateAgentCode(request.getCode());
        }

        AgentDefinitionEntity entity = new AgentDefinitionEntity();
        entity.setId(newAgentId());
        entity.setTenantId(tenantId);
        entity.setAgentCode(request.getCode());
        entity.setName(request.getName());
        entity.setDescription(request.getDescription() != null ? request.getDescription() : "");
        entity.setModelId(request.getModelId());
        entity.setSystemPrompt(request.getSystemPrompt());
        entity.setTools(toJson(request.getTools()));
        entity.setRagScopes(toJson(request.getRagScopes()));
        entity.setTemperature(String.valueOf(request.getTemperature() != null ? request.getTemperature() : 0.7));
        entity.setMaxTokens(String.valueOf(request.getMaxTokens() != null ? request.getMaxTokens() : 4096));
        entity.setStatus(request.getStatus() != null ? request.getStatus() : STATUS_DRAFT);

        AgentDefinitionEntity saved = agentRepository.save(entity);

        // 初始版本
        recordVersion(tenantId, saved.getId(), "1.0.0", "初始创建", saved, createdBy);
        // 创建日志
        recordLog(tenantId, saved.getId(),
                createdBy != null ? createdBy : "system", "create");

        return toResponse(saved);
    }

    /**
     * Agent 列表（分页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<AgentResponse> list(String tenantId, String status, int page, int pageSize) {
        validateStatusOptional(status);
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.ASC, "createdAt"));

        // 无状态过滤：直接分页查询
        if (status == null || status.isBlank()) {
            Page<AgentDefinitionEntity> pageResult =
                    agentRepository.findByTenantIdAndDeletedAtIsNull(tenantId, pageRequest);
            return toPageResponse(pageResult);
        }

        // 有状态过滤：Repository 未提供 status 分页方法，全量查后手动分页
        List<AgentDefinitionEntity> all =
                agentRepository.findByTenantIdAndStatusAndDeletedAtIsNull(tenantId, status);
        List<AgentResponse> filtered = all.stream().map(this::toResponse).toList();
        int total = filtered.size();
        int fromIndex = Math.min((page - 1) * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<AgentResponse> pageItems = filtered.subList(fromIndex, toIndex);
        return PageResponse.of(pageItems, total, page, pageSize);
    }

    /**
     * Agent 详情。
     */
    @Transactional(readOnly = true)
    public AgentResponse get(String tenantId, String agentId) {
        AgentDefinitionEntity entity = agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));
        return toResponse(entity);
    }

    /**
     * 更新 Agent。
     */
    @Transactional
    public AgentResponse update(String tenantId, String agentId, UpdateAgentRequest request, String updatedBy) {
        AgentDefinitionEntity entity = agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));

        Map<String, Object> changedFields = new LinkedHashMap<>();

        if (request.getName() != null) {
            entity.setName(request.getName());
            changedFields.put("name", request.getName());
        }
        if (request.getCode() != null) {
            if (!request.getCode().equals(entity.getAgentCode())) {
                if (agentRepository.existsByTenantIdAndAgentCode(tenantId, request.getCode())) {
                    throw AgentException.duplicateAgentCode(request.getCode());
                }
            }
            entity.setAgentCode(request.getCode());
            changedFields.put("agent_code", request.getCode());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
            changedFields.put("description", request.getDescription());
        }
        if (request.getModelId() != null) {
            entity.setModelId(request.getModelId());
            changedFields.put("model_id", request.getModelId());
        }
        if (request.getSystemPrompt() != null) {
            entity.setSystemPrompt(request.getSystemPrompt());
            changedFields.put("system_prompt", request.getSystemPrompt());
        }
        if (request.getTools() != null) {
            entity.setTools(toJson(request.getTools()));
            changedFields.put("tools", request.getTools());
        }
        if (request.getRagScopes() != null) {
            entity.setRagScopes(toJson(request.getRagScopes()));
            changedFields.put("rag_scopes", request.getRagScopes());
        }
        if (request.getTemperature() != null) {
            entity.setTemperature(String.valueOf(request.getTemperature()));
            changedFields.put("temperature", request.getTemperature());
        }
        if (request.getMaxTokens() != null) {
            entity.setMaxTokens(String.valueOf(request.getMaxTokens()));
            changedFields.put("max_tokens", request.getMaxTokens());
        }
        if (request.getStatus() != null) {
            validateStatus(request.getStatus());
            entity.setStatus(request.getStatus());
            changedFields.put("status", request.getStatus());
        }

        if (changedFields.isEmpty()) {
            return toResponse(entity);
        }

        AgentDefinitionEntity updated = agentRepository.save(entity);

        // 版本快照
        String changeLog = summarizeChanges(changedFields);
        String latestVersion = latestVersion(tenantId, updated.getId());
        String newVersion = bumpVersion(latestVersion);
        recordVersion(tenantId, updated.getId(), newVersion, changeLog, updated, updatedBy);
        // 操作日志
        recordLog(tenantId, updated.getId(),
                updatedBy != null ? updatedBy : "system", "update");

        return toResponse(updated);
    }

    /**
     * 软删除 Agent：仅允许删除非 ACTIVE 状态的 Agent。
     */
    @Transactional
    public boolean delete(String tenantId, String agentId, String deletedBy) {
        AgentDefinitionEntity entity = agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));

        if (STATUS_ACTIVE.equals(entity.getStatus())) {
            throw AgentException.invalidParam("无法删除 ACTIVE 状态的 Agent，请先禁用");
        }

        entity.setDeletedAt(java.time.OffsetDateTime.now());
        agentRepository.save(entity);

        recordLog(tenantId, agentId,
                deletedBy != null ? deletedBy : "system", "delete");
        return true;
    }

    /**
     * 克隆 Agent：以源 Agent 为模板创建新 Agent。
     */
    @Transactional
    public AgentResponse clone(String tenantId, String agentId, CloneAgentRequest request, String clonedBy) {
        AgentDefinitionEntity source = agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));

        if (agentRepository.existsByTenantIdAndAgentCode(tenantId, request.getNewAgentCode())) {
            throw AgentException.duplicateAgentCode(request.getNewAgentCode());
        }

        AgentDefinitionEntity clone = new AgentDefinitionEntity();
        clone.setId(newAgentId());
        clone.setTenantId(tenantId);
        clone.setAgentCode(request.getNewAgentCode());
        clone.setName(request.getNewName());
        clone.setDescription(source.getDescription());
        clone.setModelId(source.getModelId());
        clone.setSystemPrompt(source.getSystemPrompt());
        clone.setTools(source.getTools());
        clone.setRagScopes(source.getRagScopes());
        clone.setTemperature(source.getTemperature());
        clone.setMaxTokens(source.getMaxTokens());
        clone.setStatus(STATUS_DRAFT);

        AgentDefinitionEntity created = agentRepository.save(clone);

        // 源 Agent 记录克隆版本快照与日志
        String sourceLatest = latestVersion(tenantId, source.getId());
        String sourceNewVersion = bumpVersion(sourceLatest);
        recordVersion(tenantId, source.getId(), sourceNewVersion,
                "克隆至新 Agent：" + request.getNewName() + "（" + request.getNewAgentCode() + "）",
                source, clonedBy);
        recordLog(tenantId, source.getId(),
                clonedBy != null ? clonedBy : "system", "clone");

        // 新 Agent 记录初始版本与创建日志
        recordVersion(tenantId, created.getId(), "1.0.0",
                "克隆自 Agent：" + source.getName() + "（" + source.getAgentCode() + "）",
                created, clonedBy);
        recordLog(tenantId, created.getId(),
                clonedBy != null ? clonedBy : "system", "create");

        return toResponse(created);
    }

    // =====================================================================
    // 版本与日志查询
    // =====================================================================

    /**
     * Agent 版本历史（分页）。审计端点：允许查询已软删 Agent 的历史版本。
     */
    @Transactional(readOnly = true)
    public PageResponse<AgentVersionResponse> listVersions(String tenantId, String agentId, int page, int pageSize) {
        // 校验 Agent 存在（含软删，便于审计）
        ensureAgentExistsIncludingDeleted(tenantId, agentId);

        List<AgentVersionEntity> all = versionRepository.findByTenantIdAndAgentId(tenantId, agentId);
        // 按创建时间倒序
        all.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));

        int total = all.size();
        int fromIndex = Math.min((page - 1) * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<AgentVersionEntity> pageItems = all.subList(fromIndex, toIndex);

        List<AgentVersionResponse> items = pageItems.stream().map(this::toVersionResponse).toList();
        return PageResponse.of(items, total, page, pageSize);
    }

    /**
     * Agent 操作日志（分页）。审计端点：允许查询已软删 Agent 的日志。
     */
    @Transactional(readOnly = true)
    public PageResponse<AgentOperationLogResponse> listLogs(String tenantId, String agentId, int page, int pageSize) {
        ensureAgentExistsIncludingDeleted(tenantId, agentId);

        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AgentOperationLogEntity> result = logRepository
                .findByTenantIdAndAgentId(tenantId, agentId, pageRequest);

        List<AgentOperationLogResponse> items = result.getContent().stream()
                .map(this::toLogResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    /**
     * 获取 Agent（含软删）— 供 employees / card 等投影模块复用。
     */
    @Transactional(readOnly = true)
    public AgentResponse getIncludingDeleted(String tenantId, String agentId) {
        Optional<AgentDefinitionEntity> opt = agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId);
        if (opt.isEmpty()) {
            // 尝试含软删查询
            opt = agentRepository.findById(agentId)
                    .filter(e -> tenantId.equals(e.getTenantId()));
        }
        return opt.map(this::toResponse)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));
    }

    /**
     * 按 agentCode 查询 Agent（仅未软删）。
     */
    @Transactional(readOnly = true)
    public Optional<AgentResponse> getByCode(String tenantId, String agentCode) {
        return agentRepository
                .findByTenantIdAndAgentCodeAndDeletedAtIsNull(tenantId, agentCode)
                .map(this::toResponse);
    }

    /**
     * 获取 Agent 实体（仅未软删）— 供 card 等模块复用。
     */
    @Transactional(readOnly = true)
    public AgentDefinitionEntity getEntity(String tenantId, String agentId) {
        return agentRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));
    }

    private void ensureAgentExistsIncludingDeleted(String tenantId, String agentId) {
        agentRepository.findById(agentId)
                .filter(e -> tenantId.equals(e.getTenantId()))
                .orElseThrow(() -> AgentException.agentNotFound(agentId));
    }

    private void recordVersion(String tenantId, String agentId, String version,
                               String changeLog, AgentDefinitionEntity snapshot, String createdBy) {
        AgentVersionEntity versionEntity = new AgentVersionEntity();
        versionEntity.setId(newVersionId());
        versionEntity.setTenantId(tenantId);
        versionEntity.setAgentId(agentId);
        versionEntity.setVersion(version);
        versionEntity.setChangeLog(changeLog != null ? changeLog : "");
        versionEntity.setSnapshot(toSnapshotJson(snapshot));
        versionEntity.setCreatedBy(createdBy);
        versionRepository.save(versionEntity);
    }

    private void recordLog(String tenantId, String agentId, String actor, String action) {
        AgentOperationLogEntity logEntity = new AgentOperationLogEntity();
        logEntity.setId(newLogId());
        logEntity.setTenantId(tenantId);
        logEntity.setAgentId(agentId);
        logEntity.setActor(actor);
        logEntity.setAction(action);
        logEntity.setResource("agent");
        logEntity.setStatus("success");
        logEntity.setTraceId(TenantContext.getTraceId());
        logRepository.save(logEntity);
    }

    private String latestVersion(String tenantId, String agentId) {
        List<AgentVersionEntity> versions = versionRepository.findByTenantIdAndAgentId(tenantId, agentId);
        if (versions.isEmpty()) {
            return null;
        }
        // 按创建时间倒序取第一个
        versions.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return versions.get(0).getVersion();
    }

    /**
     * 语义化版本号递增：patch +1。
     */
    static String bumpVersion(String latest) {
        if (latest == null || latest.isBlank()) {
            return "1.0.0";
        }
        String[] parts = latest.split("\\.");
        if (parts.length != 3) {
            return "1.0.0";
        }
        try {
            int major = Integer.parseInt(parts[0]);
            int minor = Integer.parseInt(parts[1]);
            int patch = Integer.parseInt(parts[2]);
            return major + "." + minor + "." + (patch + 1);
        } catch (NumberFormatException e) {
            return "1.0.0";
        }
    }

    /**
     * 变更摘要（中文字段名映射）。
     */
    static String summarizeChanges(Map<String, Object> fields) {
        List<String> names = new ArrayList<>();
        if (fields.containsKey("name")) names.add("名称");
        if (fields.containsKey("agent_code")) names.add("编码");
        if (fields.containsKey("description")) names.add("描述");
        if (fields.containsKey("model_id")) names.add("模型");
        if (fields.containsKey("system_prompt")) names.add("系统提示词");
        if (fields.containsKey("tools")) names.add("工具列表");
        if (fields.containsKey("rag_scopes")) names.add("知识库范围");
        if (fields.containsKey("temperature")) names.add("温度");
        if (fields.containsKey("max_tokens")) names.add("最大 token");
        if (fields.containsKey("status")) names.add("状态");
        return names.isEmpty() ? "更新" : "更新：" + String.join("、", names);
    }

    // =====================================================================
    // 实体 → 响应转换
    // =====================================================================

    private AgentResponse toResponse(AgentDefinitionEntity e) {
        return AgentResponse.builder()
                .agentId(e.getId())
                .tenantId(e.getTenantId())
                .code(e.getAgentCode())
                .name(e.getName())
                .description(e.getDescription())
                .modelId(e.getModelId())
                .systemPrompt(e.getSystemPrompt())
                .tools(fromJsonList(e.getTools()))
                .ragScopes(fromJsonList(e.getRagScopes()))
                .temperature(parseDouble(e.getTemperature(), 0.7))
                .maxTokens(parseInt(e.getMaxTokens(), 4096))
                .status(e.getStatus())
                .deletedAt(e.getDeletedAt())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private AgentVersionResponse toVersionResponse(AgentVersionEntity e) {
        return AgentVersionResponse.builder()
                .version(e.getVersion())
                .timestamp(e.getCreatedAt())
                .changeLog(e.getChangeLog())
                .snapshot(parseJsonNode(e.getSnapshot()))
                .createdBy(e.getCreatedBy())
                .build();
    }

    private AgentOperationLogResponse toLogResponse(AgentOperationLogEntity e) {
        return AgentOperationLogResponse.builder()
                .id(e.getId())
                .actor(e.getActor())
                .action(e.getAction())
                .resource(e.getResource())
                .timestamp(e.getCreatedAt())
                .ip(e.getIp())
                .status(e.getStatus())
                .traceId(e.getTraceId())
                .build();
    }

    private PageResponse<AgentResponse> toPageResponse(Page<AgentDefinitionEntity> page) {
        List<AgentResponse> items = page.getContent().stream().map(this::toResponse).toList();
        return PageResponse.of(items, page.getTotalElements(), page.getNumber() + 1, page.getSize());
    }

    // =====================================================================
    // JSON 序列化/反序列化辅助
    // =====================================================================

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            log.warn("JSON 序列化失败，回退为空数组", e);
            return "[]";
        }
    }

    private List<String> fromJsonList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            log.warn("JSON 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    private String toSnapshotJson(AgentDefinitionEntity entity) {
        try {
            // 使用 AgentResponse 的结构作为快照
            AgentResponse resp = toResponse(entity);
            return objectMapper.writeValueAsString(resp);
        } catch (JsonProcessingException e) {
            log.warn("快照序列化失败", e);
            return "{}";
        }
    }

    private JsonNode parseJsonNode(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            log.warn("JSON 解析为 JsonNode 失败: {}", json, e);
            return null;
        }
    }

    private double parseDouble(String value, double defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private int parseInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    // =====================================================================
    // 校验辅助
    // =====================================================================

    private void validateStatus(String status) {
        if (status == null || status.isBlank()) {
            return;
        }
        if (!ALLOWED_STATUS.contains(status.toUpperCase())) {
            throw AgentException.invalidParam("不支持的 Agent 状态: " + status);
        }
    }

    private void validateStatusOptional(String status) {
        if (status != null && !status.isBlank()) {
            validateStatus(status);
        }
    }

    // =====================================================================
    // ID 生成
    // =====================================================================

    private static String newAgentId() {
        return "agt-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }

    private static String newVersionId() {
        return "agv-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }

    private static String newLogId() {
        return "agl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }
}
