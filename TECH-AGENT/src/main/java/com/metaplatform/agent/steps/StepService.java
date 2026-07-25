package com.metaplatform.agent.steps;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.entity.AgentEvaluationEntity;
import com.metaplatform.agent.entity.AgentStepEntity;
import com.metaplatform.agent.entity.AgentToolCallEntity;
import com.metaplatform.agent.repository.AgentEvaluationRepository;
import com.metaplatform.agent.repository.AgentStepRepository;
import com.metaplatform.agent.repository.AgentToolCallRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 步骤服务：记录步骤、思维链、工具调用、评估。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StepService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AgentStepRepository stepRepository;
    private final AgentToolCallRepository toolCallRepository;
    private final AgentEvaluationRepository evaluationRepository;
    private final ObjectMapper objectMapper;

    /**
     * 记录执行步骤。
     */
    @Transactional
    public StepResponse recordStep(String tenantId, String executionId,
                                   String stepType, String content,
                                   int sortOrder, Map<String, Object> metadata) {
        AgentStepEntity entity = new AgentStepEntity();
        entity.setId("step-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setExecutionId(executionId);
        entity.setTenantId(tenantId);
        entity.setStepType(stepType);
        entity.setContent(content);
        entity.setSortOrder(sortOrder);
        entity.setMetadata(toJson(metadata));
        AgentStepEntity saved = stepRepository.save(entity);
        return toStepResponse(saved);
    }

    /**
     * 获取执行步骤列表。
     */
    @Transactional(readOnly = true)
    public List<StepResponse> getSteps(String tenantId, String executionId) {
        return stepRepository.findByTenantIdAndExecutionId(tenantId, executionId).stream()
                .map(this::toStepResponse)
                .toList();
    }

    /**
     * 获取思维链（仅 THINKING 类型步骤）。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getThinkingChain(String tenantId, String executionId) {
        List<StepResponse> thinkingSteps = stepRepository
                .findByTenantIdAndExecutionId(tenantId, executionId).stream()
                .filter(s -> "THINKING".equals(s.getStepType()))
                .map(this::toStepResponse)
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("executionId", executionId);
        result.put("steps", thinkingSteps);
        result.put("totalSteps", thinkingSteps.size());
        return result;
    }

    /**
     * 获取工具调用记录。
     */
    @Transactional(readOnly = true)
    public List<ToolCallResponse> getToolCalls(String tenantId, String executionId) {
        return toolCallRepository.findByTenantIdAndExecutionId(tenantId, executionId).stream()
                .map(this::toToolCallResponse)
                .toList();
    }

    /**
     * 提交评估。
     */
    @Transactional
    public EvaluationResponse submitEvaluation(String tenantId, String executionId, SubmitEvaluationRequest request) {
        AgentEvaluationEntity entity = new AgentEvaluationEntity();
        entity.setId("eval-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setExecutionId(executionId);
        entity.setTenantId(tenantId);
        entity.setScore(request.getScore());
        entity.setFeedback(request.getFeedback());
        entity.setEvaluator(request.getEvaluator());
        AgentEvaluationEntity saved = evaluationRepository.save(entity);
        return toEvaluationResponse(saved);
    }

    /**
     * 获取评估列表。
     */
    @Transactional(readOnly = true)
    public List<EvaluationResponse> getEvaluations(String tenantId, String executionId) {
        return evaluationRepository.findByTenantIdAndExecutionId(tenantId, executionId).stream()
                .map(this::toEvaluationResponse)
                .toList();
    }

    // ----------------------------------------------------------- helpers

    private StepResponse toStepResponse(AgentStepEntity entity) {
        return StepResponse.builder()
                .stepId(entity.getId())
                .executionId(entity.getExecutionId())
                .tenantId(entity.getTenantId())
                .stepType(entity.getStepType())
                .content(entity.getContent())
                .sortOrder(entity.getSortOrder())
                .metadata(fromJson(entity.getMetadata()))
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private ToolCallResponse toToolCallResponse(AgentToolCallEntity entity) {
        return ToolCallResponse.builder()
                .toolCallId(entity.getId())
                .executionId(entity.getExecutionId())
                .tenantId(entity.getTenantId())
                .toolName(entity.getToolName())
                .toolInput(fromJson(entity.getToolInput()))
                .toolOutput(fromJson(entity.getToolOutput()))
                .status(entity.getStatus())
                .durationMs(entity.getDurationMs())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private EvaluationResponse toEvaluationResponse(AgentEvaluationEntity entity) {
        return EvaluationResponse.builder()
                .evaluationId(entity.getId())
                .executionId(entity.getExecutionId())
                .tenantId(entity.getTenantId())
                .score(entity.getScore())
                .feedback(entity.getFeedback())
                .evaluator(entity.getEvaluator())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private String toJson(Map<String, Object> map) {
        if (map == null || map.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            log.warn("序列化 metadata 失败", e);
            return null;
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            log.warn("反序列化 JSON 失败 | json={}", json, e);
            return null;
        }
    }
}
