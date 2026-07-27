package com.metaplatform.agent.checkpoint;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.entity.AgentCheckpointEntity;
import com.metaplatform.agent.repository.AgentCheckpointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 检查点服务：保存、加载、列出、删除执行状态。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckpointService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AgentCheckpointRepository checkpointRepository;
    private final ObjectMapper objectMapper;

    /**
     * 保存检查点。
     */
    @Transactional
    public CheckpointResponse save(String tenantId, String executionId, String agentId, Map<String, Object> state) {
        AgentCheckpointEntity entity = new AgentCheckpointEntity();
        entity.setCheckpointId("ckpt-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setExecutionId(executionId);
        entity.setTenantId(tenantId);
        entity.setAgentId(agentId);
        try {
            entity.setState(objectMapper.writeValueAsString(state == null ? Map.of() : state));
        } catch (Exception e) {
            throw new IllegalStateException("序列化 checkpoint state 失败", e);
        }
        AgentCheckpointEntity saved = checkpointRepository.save(entity);
        return toResponse(saved);
    }

    /**
     * 加载检查点（取最新一条）。
     */
    @Transactional(readOnly = true)
    public Optional<CheckpointResponse> load(String tenantId, String executionId) {
        List<AgentCheckpointEntity> entities = checkpointRepository
                .findByTenantIdAndExecutionId(tenantId, executionId);
        if (entities.isEmpty()) {
            return Optional.empty();
        }
        // 取最后一条（时间最新）
        return Optional.of(toResponse(entities.get(entities.size() - 1)));
    }

    /**
     * 按 Agent 列出检查点。
     */
    /** Restore latest checkpoint state without exposing mutable persistence objects. */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> resumeState(String tenantId, String executionId) {
        return load(tenantId, executionId).map(checkpoint -> {
            Map<String, Object> resumed = new java.util.LinkedHashMap<>();
            resumed.put("checkpointId", checkpoint.getCheckpointId());
            resumed.put("executionId", checkpoint.getExecutionId());
            resumed.put("agentId", checkpoint.getAgentId());
            resumed.put("state", checkpoint.getState() == null ? Map.of() : checkpoint.getState());
            resumed.put("resumedAt", java.time.OffsetDateTime.now().toString());
            return java.util.Collections.unmodifiableMap(resumed);
        });
    }

    @Transactional(readOnly = true)
    public List<CheckpointResponse> listByAgent(String tenantId, String agentId) {
        return checkpointRepository.findByTenantIdAndAgentId(tenantId, agentId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * 删除检查点。
     */
    @Transactional
    public boolean delete(String tenantId, String executionId) {
        List<AgentCheckpointEntity> entities = checkpointRepository
                .findByTenantIdAndExecutionId(tenantId, executionId);
        if (entities.isEmpty()) {
            return false;
        }
        checkpointRepository.deleteAll(entities);
        return true;
    }

    private CheckpointResponse toResponse(AgentCheckpointEntity entity) {
        Map<String, Object> stateMap = Map.of();
        if (entity.getState() != null && !entity.getState().isBlank()) {
            try {
                stateMap = objectMapper.readValue(entity.getState(), MAP_TYPE);
            } catch (Exception e) {
                log.warn("反序列化 checkpoint state 失败 | checkpointId={}", entity.getCheckpointId(), e);
            }
        }
        return CheckpointResponse.builder()
                .checkpointId(entity.getCheckpointId())
                .executionId(entity.getExecutionId())
                .agentId(entity.getAgentId())
                .tenantId(entity.getTenantId())
                .state(stateMap)
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
