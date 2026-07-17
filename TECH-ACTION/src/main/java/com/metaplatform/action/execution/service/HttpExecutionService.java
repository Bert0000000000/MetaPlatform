package com.metaplatform.action.execution.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.entity.ExecutionEntity;
import com.metaplatform.action.execution.repository.ExecutionRepository;
import com.metaplatform.action.outbox.service.ActionEventType;
import com.metaplatform.action.outbox.service.ActionOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class HttpExecutionService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_FAILED = "FAILED";

    private final ActionDefinitionRepository actionDefinitionRepository;
    private final ExecutionRepository executionRepository;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;
    private final ActionOutboxService actionOutboxService;

    @Transactional
    public SyncExecutionResponse executeSync(SyncExecutionRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ActionDefinitionEntity action = actionDefinitionRepository
                .findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getActionCode())
                .orElseThrow(() -> new ActionException(ErrorCode.ACTION_NOT_FOUND,
                        "Action 不存在: " + request.getActionCode()));

        if (!"PUBLISHED".equals(action.getStatus())) {
            throw new ActionException(ErrorCode.ACTION_NOT_PUBLISHED,
                    "Action 未发布，不可执行: " + request.getActionCode());
        }

        String executionId = "exec-" + UUID.randomUUID();
        Instant startedAt = Instant.now();
        String inputJson = writeValueAsString(request.getInput());
        String traceId = TraceContext.getOrCreate();

        ExecutionEntity execution = ExecutionEntity.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .actionId(action.getActionId())
                .actionCode(action.getCode())
                .status(STATUS_PENDING)
                .input(inputJson)
                .traceId(traceId)
                .startedAt(startedAt)
                .createdAt(startedAt)
                .updatedAt(startedAt)
                .build();
        executionRepository.save(execution);

        Object output;
        try {
            output = performHttpCall(action, request.getInput());
        } catch (ActionException e) {
            Instant failedAt = Instant.now();
            execution.setStatus(STATUS_FAILED);
            execution.setErrorCode(String.valueOf(e.getErrorCode().getCode()));
            execution.setErrorMessage(e.getMessage());
            execution.setCompletedAt(failedAt);
            execution.setDurationMs((int) (failedAt.toEpochMilli() - startedAt.toEpochMilli()));
            execution.setUpdatedAt(failedAt);
            executionRepository.save(execution);
            publishExecutedEvent(execution);
            throw e;
        } catch (Exception e) {
            Instant failedAt = Instant.now();
            execution.setStatus(STATUS_FAILED);
            execution.setErrorCode(String.valueOf(ErrorCode.HTTP_EXECUTION_ERROR.getCode()));
            execution.setErrorMessage(e.getMessage());
            execution.setCompletedAt(failedAt);
            execution.setDurationMs((int) (failedAt.toEpochMilli() - startedAt.toEpochMilli()));
            execution.setUpdatedAt(failedAt);
            executionRepository.save(execution);
            publishExecutedEvent(execution);
            throw new ActionException(ErrorCode.HTTP_EXECUTION_ERROR, e.getMessage());
        }

        Instant completedAt = Instant.now();
        String outputJson = writeValueAsString(output);
        execution.setStatus(STATUS_COMPLETED);
        execution.setOutput(outputJson);
        execution.setCompletedAt(completedAt);
        execution.setDurationMs((int) (completedAt.toEpochMilli() - startedAt.toEpochMilli()));
        execution.setUpdatedAt(completedAt);
        executionRepository.save(execution);
        publishExecutedEvent(execution);

        return SyncExecutionResponse.builder()
                .executionId(executionId)
                .actionId(action.getActionId())
                .actionCode(action.getCode())
                .status(STATUS_COMPLETED)
                .input(request.getInput())
                .output(output)
                .startedAt(startedAt)
                .completedAt(completedAt)
                .durationMs(execution.getDurationMs())
                .build();
    }

    private Object performHttpCall(ActionDefinitionEntity action, Object input) {
        RestClient client = restClientBuilder.baseUrl(action.getUrl()).build();
        RestClient.RequestBodySpec spec = client.method(resolveHttpMethod(action.getMethod()))
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> addActionHeaders(headers, action.getHeaders()));

        if (input != null) {
            spec.body(input);
        }

        return spec.retrieve()
                .body(Object.class);
    }

    private org.springframework.http.HttpMethod resolveHttpMethod(String method) {
        try {
            return org.springframework.http.HttpMethod.valueOf(method.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "不支持的 HTTP method: " + method);
        }
    }

    @SuppressWarnings("unchecked")
    private void addActionHeaders(org.springframework.http.HttpHeaders headers, String headersJson) {
        if (headersJson == null || headersJson.isBlank()) {
            return;
        }
        try {
            Map<String, String> map = objectMapper.readValue(headersJson, Map.class);
            map.forEach(headers::add);
        } catch (JsonProcessingException e) {
            log.warn("Action headers 解析失败: {}", headersJson, e);
        }
    }

    private String writeValueAsString(Object value) {
        if (value == null) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "输入数据序列化失败");
        }
    }

    private void publishExecutedEvent(ExecutionEntity execution) {
        try {
            Map<String, Object> eventPayload = new LinkedHashMap<>();
            eventPayload.put("executionId", execution.getExecutionId());
            eventPayload.put("actionId", execution.getActionId());
            eventPayload.put("actionCode", execution.getActionCode());
            eventPayload.put("status", execution.getStatus());
            eventPayload.put("durationMs", execution.getDurationMs());
            eventPayload.put("errorCode", execution.getErrorCode());
            eventPayload.put("errorMessage", execution.getErrorMessage());
            eventPayload.put("startedAt", execution.getStartedAt());
            eventPayload.put("completedAt", execution.getCompletedAt());
            actionOutboxService.publish(execution.getTenantId(), execution.getExecutionId(),
                    ActionEventType.ACTION_EXECUTED, eventPayload, execution.getTraceId());
        } catch (Exception e) {
            log.warn("Failed to publish ACTION_EXECUTED event for execution {}: {}",
                    execution.getExecutionId(), e.getMessage());
        }
    }
}
