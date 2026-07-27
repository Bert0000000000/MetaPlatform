package com.metaplatform.llmgw.routing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.entity.RoutingRuleEntity;
import com.metaplatform.llmgw.repository.RoutingRuleEntityRepository;
import com.metaplatform.llmgw.routing.dto.CreateRoutingRuleRequest;
import com.metaplatform.llmgw.routing.dto.RoutingRuleDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RoutingService {

    private final RoutingRuleEntityRepository routingRuleEntityRepository;
    private final ObjectMapper objectMapper;

    public RoutingRuleDto createRule(CreateRoutingRuleRequest request) {
        RoutingRuleEntity entity = new RoutingRuleEntity();
        entity.setName(request.name());
        entity.setPriority(request.priority());
        entity.setConditionType(request.conditionType());
        entity.setConditionValue(writeJson(request.conditionValue()));
        entity.setTargetModel(request.targetModel());
        entity.setIsActive(true);
        RoutingRuleEntity saved = routingRuleEntityRepository.save(entity);
        return toDto(saved);
    }

    public RoutingRuleDto getRule(Long id) {
        RoutingRuleEntity entity = routingRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Routing rule not found: " + id));
        return toDto(entity);
    }

    public List<RoutingRuleDto> listRules(boolean activeOnly) {
        List<RoutingRuleEntity> entities = activeOnly
                ? routingRuleEntityRepository.findByIsActiveTrueOrderByPriorityDesc()
                : routingRuleEntityRepository.findAll();
        return entities.stream().map(this::toDto).toList();
    }

    public RoutingRuleDto updateRule(Long id, CreateRoutingRuleRequest request) {
        RoutingRuleEntity entity = routingRuleEntityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Routing rule not found: " + id));
        entity.setName(request.name());
        entity.setPriority(request.priority());
        entity.setConditionType(request.conditionType());
        entity.setConditionValue(writeJson(request.conditionValue()));
        entity.setTargetModel(request.targetModel());
        RoutingRuleEntity saved = routingRuleEntityRepository.save(entity);
        return toDto(saved);
    }

    public void deleteRule(Long id) {
        routingRuleEntityRepository.deleteById(id);
    }

    public String selectModel(String taskType, String userId, String appId) {
        List<RoutingRuleEntity> rules = routingRuleEntityRepository.findByIsActiveTrueOrderByPriorityDesc();
        for (RoutingRuleEntity rule : rules) {
            Map<String, Object> condition = readJson(rule.getConditionValue());
            if (matches(rule.getConditionType(), condition, taskType, userId, appId)) {
                return rule.getTargetModel();
            }
        }
        return null;
    }

    private boolean matches(String conditionType, Map<String, Object> condition, String taskType, String userId, String appId) {
        if ("task_type".equals(conditionType)) {
            return matchValue(condition, "taskType", taskType);
        }
        if ("user_id".equals(conditionType)) {
            return matchValue(condition, "userId", userId);
        }
        if ("app_id".equals(conditionType)) {
            return matchValue(condition, "appId", appId);
        }
        if ("expression".equals(conditionType)) {
            return matchExpression(condition, taskType, userId, appId);
        }
        return "any".equals(conditionType);
    }

    private boolean matchValue(Map<String, Object> condition, String key, String value) {
        Object expected = condition.get(key);
        if (expected instanceof List<?> list) {
            return list.stream().map(Object::toString).anyMatch(v -> v.equals(value));
        }
        return expected != null && expected.toString().equals(value);
    }

    private boolean matchExpression(Map<String, Object> condition, String taskType, String userId, String appId) {
        Object expectedTaskType = condition.get("taskType");
        Object expectedUserId = condition.get("userId");
        Object expectedAppId = condition.get("appId");
        boolean matched = true;
        if (expectedTaskType != null) {
            matched = expectedTaskType.toString().equals(taskType);
        }
        if (matched && expectedUserId != null) {
            matched = expectedUserId.toString().equals(userId);
        }
        if (matched && expectedAppId != null) {
            matched = expectedAppId.toString().equals(appId);
        }
        return matched;
    }

    private RoutingRuleDto toDto(RoutingRuleEntity entity) {
        return new RoutingRuleDto(
                entity.getId(),
                entity.getName(),
                entity.getPriority(),
                entity.getConditionType(),
                readJson(entity.getConditionValue()),
                entity.getTargetModel(),
                entity.getIsActive()
        );
    }

    private String writeJson(Map<String, Object> value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize condition value", e);
        }
    }

    private Map<String, Object> readJson(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize condition value", e);
        }
    }
}
