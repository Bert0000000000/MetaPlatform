package com.metaplatform.action.remediation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.execution.entity.ExecutionEntity;
import com.metaplatform.action.execution.repository.ExecutionRepository;
import com.metaplatform.action.remediation.dto.RemediationRequest;
import com.metaplatform.action.remediation.dto.RemediationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RemediationActionService {

    public static final String ACTION_SERVICE_RESTART = "serviceRestart";
    public static final String ACTION_CACHE_CLEAR = "cacheClear";
    public static final String ACTION_CONFIG_ROLLBACK = "configRollback";

    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String MODE_AUTO = "AUTO";

    private static final Map<String, String> ACTION_NAMES = Map.of(
            ACTION_SERVICE_RESTART, "重启服务",
            ACTION_CACHE_CLEAR, "清理缓存",
            ACTION_CONFIG_ROLLBACK, "回滚配置");

    private final ExecutionRepository executionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RemediationResponse remediate(RemediationRequest request) {
        String anomalyType = request.getAnomalyType() != null ? request.getAnomalyType().toUpperCase() : "";
        String actionCode = request.getActionCode() != null && !request.getActionCode().isBlank()
                ? request.getActionCode()
                : resolveActionByAnomalyType(anomalyType);
        String actionName = ACTION_NAMES.getOrDefault(actionCode, "未知修复动作");
        boolean auto = MODE_AUTO.equalsIgnoreCase(request.getMode());

        String message = String.format("建议对服务 %s 执行「%s」以修复 %s 异常",
                request.getServiceName(), actionName, anomalyType);

        if (!auto) {
            return RemediationResponse.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .actionName(actionName)
                    .message(message)
                    .build();
        }

        String executionId = "rem-" + UUID.randomUUID();
        Instant now = Instant.now();
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("anomalyType", anomalyType);
        input.put("serviceName", request.getServiceName());
        input.put("actionCode", actionCode);
        input.put("traceId", request.getTraceId());

        ExecutionEntity execution = ExecutionEntity.builder()
                .tenantId(TenantContext.getOrDefault())
                .executionId(executionId)
                .actionId("remediation-" + actionCode)
                .actionCode(actionCode)
                .status(STATUS_COMPLETED)
                .input(writeJson(input))
                .output(writeJson(Map.of("result", "mock-success", "actionName", actionName)))
                .traceId(request.getTraceId() != null ? request.getTraceId() : TraceContext.getOrCreate())
                .startedAt(now)
                .completedAt(now)
                .durationMs(120)
                .createdAt(now)
                .updatedAt(now)
                .build();
        executionRepository.save(execution);

        return RemediationResponse.builder()
                .executed(true)
                .actionCode(actionCode)
                .actionName(actionName)
                .message(message + "（已模拟执行）")
                .executionId(executionId)
                .build();
    }

    private String resolveActionByAnomalyType(String anomalyType) {
        return switch (anomalyType) {
            case "ERROR_RATE" -> ACTION_SERVICE_RESTART;
            case "P99_LATENCY" -> ACTION_CACHE_CLEAR;
            case "ERROR_CODE" -> ACTION_CONFIG_ROLLBACK;
            default -> ACTION_SERVICE_RESTART;
        };
    }

    private String writeJson(Object value) {
        if (value == null) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize remediation input/output", e);
            return "{}";
        }
    }
}
