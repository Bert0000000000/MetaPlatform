package com.metaplatform.action.remediation.service;

import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.HttpExecutionService;
import com.metaplatform.action.remediation.dto.RemediationRequest;
import com.metaplatform.action.remediation.dto.RemediationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 修复动作服务：以 Action 驱动，通过已发布的 {@link ActionDefinitionEntity}
 * 委托 {@link HttpExecutionService} 真实执行；未配置时返回明确的错误而非成功。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RemediationActionService {

    public static final String ACTION_SERVICE_RESTART = "serviceRestart";
    public static final String ACTION_CACHE_CLEAR = "cacheClear";
    public static final String ACTION_CONFIG_ROLLBACK = "configRollback";

    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String MODE_AUTO = "AUTO";

    private final ActionDefinitionRepository actionDefinitionRepository;
    private final HttpExecutionService httpExecutionService;

    public RemediationResponse remediate(RemediationRequest request) {
        String anomalyType = request.getAnomalyType() != null ? request.getAnomalyType().toUpperCase() : "";
        String actionCode = request.getActionCode() != null && !request.getActionCode().isBlank()
                ? request.getActionCode()
                : resolveActionByAnomalyType(anomalyType);
        boolean auto = MODE_AUTO.equalsIgnoreCase(request.getMode());

        String tenantId = TenantContext.getOrDefault();
        Optional<ActionDefinitionEntity> actionOpt = actionDefinitionRepository
                .findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, actionCode);

        // 未找到 ActionDefinition：返回明确的"未配置修复动作"错误（而非成功）
        if (actionOpt.isEmpty()) {
            String message = String.format(
                    "未配置修复动作：actionCode=%s（服务 %s 的 %s 异常未匹配到已发布的 ActionDefinition）",
                    actionCode, request.getServiceName(), anomalyType);
            log.warn("Remediation action not configured: actionCode={}, tenantId={}, anomalyType={}",
                    actionCode, tenantId, anomalyType);
            return RemediationResponse.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .actionName(actionCode)
                    .message(message)
                    .build();
        }

        ActionDefinitionEntity action = actionOpt.get();

        // 找到但未发布：返回明确的错误
        if (!STATUS_PUBLISHED.equals(action.getStatus())) {
            String message = String.format(
                    "修复动作未发布：actionCode=%s 当前状态为 %s，仅 PUBLISHED 状态可执行（服务 %s 的 %s 异常）",
                    actionCode, action.getStatus(), request.getServiceName(), anomalyType);
            log.warn("Remediation action not published: actionCode={}, status={}", actionCode, action.getStatus());
            return RemediationResponse.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .actionName(action.getName())
                    .message(message)
                    .build();
        }

        String actionName = action.getName();
        String message = String.format("建议对服务 %s 执行「%s」以修复 %s 异常",
                request.getServiceName(), actionName, anomalyType);

        // 手动模式：仅返回建议，不执行
        if (!auto) {
            return RemediationResponse.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .actionName(actionName)
                    .message(message)
                    .build();
        }

        // 自动模式：通过 HttpExecutionService 真实执行
        if (request.getTraceId() != null && !request.getTraceId().isBlank()) {
            TraceContext.set(request.getTraceId());
        }

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("anomalyType", anomalyType);
        input.put("serviceName", request.getServiceName());
        input.put("actionCode", actionCode);
        input.put("traceId", request.getTraceId());

        SyncExecutionRequest syncRequest = new SyncExecutionRequest();
        syncRequest.setActionCode(actionCode);
        syncRequest.setInput(input);

        try {
            SyncExecutionResponse response = httpExecutionService.executeSync(syncRequest);
            return RemediationResponse.builder()
                    .executed(true)
                    .actionCode(actionCode)
                    .actionName(actionName)
                    .message(message + "（已执行）")
                    .executionId(response.getExecutionId())
                    .build();
        } catch (ActionException e) {
            log.warn("Remediation action execution failed: actionCode={}, error={}", actionCode, e.getMessage());
            return RemediationResponse.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .actionName(actionName)
                    .message(message + "（执行失败：" + e.getMessage() + "）")
                    .executionId(null)
                    .build();
        }
    }

    private String resolveActionByAnomalyType(String anomalyType) {
        return switch (anomalyType) {
            case "ERROR_RATE" -> ACTION_SERVICE_RESTART;
            case "P99_LATENCY" -> ACTION_CACHE_CLEAR;
            case "ERROR_CODE" -> ACTION_CONFIG_ROLLBACK;
            default -> ACTION_SERVICE_RESTART;
        };
    }
}
