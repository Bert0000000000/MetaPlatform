package com.metaplatform.action.execution.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TraceFilter;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.AbortExecutionRequest;
import com.metaplatform.action.execution.dto.AbortExecutionResponse;
import com.metaplatform.action.execution.dto.ExecutionDetailResponse;
import com.metaplatform.action.execution.dto.ExecutionListItem;
import com.metaplatform.action.execution.dto.ExecutionLogResponse;
import com.metaplatform.action.execution.dto.ExecutionStepResponse;
import com.metaplatform.action.execution.dto.RetryExecutionResponse;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.ExecutionMonitorService;
import com.metaplatform.action.execution.service.HttpExecutionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@link ExecutionController} 单元测试 — 覆盖同步执行 + 执行监控端点。
 */
@WebMvcTest(controllers = ExecutionController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ExecutionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private HttpExecutionService httpExecutionService;

    @MockBean
    private ExecutionMonitorService executionMonitorService;

    // =====================================================================
    // 同步执行
    // =====================================================================

    @Test
    void executeSync_shouldReturn200() throws Exception {
        SyncExecutionRequest request = new SyncExecutionRequest();
        request.setActionCode("queryOrder");
        request.setInput(java.util.Map.of("orderId", "O-001"));

        SyncExecutionResponse response = SyncExecutionResponse.builder()
                .executionId("exec-001")
                .actionId("act-001")
                .actionCode("queryOrder")
                .status("COMPLETED")
                .input(request.getInput())
                .output(java.util.Map.of("status", "SHIPPED"))
                .startedAt(Instant.now())
                .completedAt(Instant.now())
                .durationMs(120)
                .build();
        when(httpExecutionService.executeSync(any(SyncExecutionRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/executions/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.executionId").value("exec-001"))
                .andExpect(jsonPath("$.data.actionCode").value("queryOrder"))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    @Test
    void executeSync_shouldRejectBlankActionCode() throws Exception {
        // actionCode 为空，触发 @Valid 校验失败
        mockMvc.perform(post("/api/v1/action/executions/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actionCode\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    // =====================================================================
    // 执行列表
    // =====================================================================

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        ExecutionListItem item = new ExecutionListItem(
                "exec-001", "act-001", "queryOrder", "COMPLETED",
                Instant.now(), Instant.now(), 120, null, null);
        PageResponse<ExecutionListItem> page = PageResponse.<ExecutionListItem>builder()
                .items(List.of(item))
                .total(1).page(1).size(20).totalPages(1).build();

        when(executionMonitorService.list(
                isNull(), isNull(), isNull(), isNull(), eq(1), eq(20)))
                .thenReturn(page);

        mockMvc.perform(get("/api/v1/action/executions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].executionId").value("exec-001"))
                .andExpect(jsonPath("$.data.items[0].actionCode").value("queryOrder"));
    }

    @Test
    void list_shouldApplyFilters() throws Exception {
        ExecutionListItem item = new ExecutionListItem(
                "exec-002", "act-001", "queryOrder", "FAILED",
                Instant.now(), Instant.now(), 80, null, null);
        PageResponse<ExecutionListItem> page = PageResponse.<ExecutionListItem>builder()
                .items(List.of(item))
                .total(1).page(1).size(10).totalPages(1).build();

        when(executionMonitorService.list(
                eq("act-001"), eq("FAILED"), isNull(), isNull(), eq(1), eq(10)))
                .thenReturn(page);

        mockMvc.perform(get("/api/v1/action/executions")
                        .param("actionId", "act-001")
                        .param("status", "FAILED")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].status").value("FAILED"));
    }

    // =====================================================================
    // 执行详情
    // =====================================================================

    @Test
    void get_shouldReturnDetail() throws Exception {
        Instant now = Instant.now();
        ExecutionDetailResponse response = new ExecutionDetailResponse(
                "exec-001", "act-001", "queryOrder", "COMPLETED",
                "{\"orderId\":\"O-001\"}", "{\"status\":\"SHIPPED\"}",
                null, null, "trace-001",
                now, now, 120, null, null, null, null,
                List.of(), List.of());
        when(executionMonitorService.get("exec-001")).thenReturn(response);

        mockMvc.perform(get("/api/v1/action/executions/exec-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("exec-001"))
                .andExpect(jsonPath("$.data.actionCode").value("queryOrder"))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.traceId").value("trace-001"));
    }

    @Test
    void get_shouldReturn404WhenNotFound() throws Exception {
        when(executionMonitorService.get("exec-missing"))
                .thenThrow(new ActionException(ErrorCode.EXECUTION_NOT_FOUND,
                        "执行记录不存在: exec-missing"));

        mockMvc.perform(get("/api/v1/action/executions/exec-missing"))
                .andExpect(status().isNotFound());
    }

    // =====================================================================
    // 中止执行
    // =====================================================================

    @Test
    void abort_shouldReturnAborted() throws Exception {
        Instant now = Instant.now();
        AbortExecutionResponse response = new AbortExecutionResponse(
                "exec-001", "ABORTED", now, false);
        when(executionMonitorService.abort(eq("exec-001"), any(AbortExecutionRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/action/executions/exec-001/abort")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"withCompensation\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("exec-001"))
                .andExpect(jsonPath("$.data.status").value("ABORTED"))
                .andExpect(jsonPath("$.data.withCompensation").value(false));
    }

    @Test
    void abort_shouldSupportEmptyBody() throws Exception {
        Instant now = Instant.now();
        AbortExecutionResponse response = new AbortExecutionResponse(
                "exec-002", "ABORTED", now, false);
        when(executionMonitorService.abort(eq("exec-002"), isNull()))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/action/executions/exec-002/abort"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("exec-002"));
    }

    @Test
    void abort_shouldReturn409WhenAlreadyFinished() throws Exception {
        when(executionMonitorService.abort(eq("exec-done"), any()))
                .thenThrow(new ActionException(ErrorCode.EXECUTION_ALREADY_FINISHED,
                        "执行已结束，不可中止"));

        mockMvc.perform(post("/api/v1/action/executions/exec-done/abort")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());
    }

    // =====================================================================
    // 重试执行
    // =====================================================================

    @Test
    void retry_shouldReturnNewExecution() throws Exception {
        Instant now = Instant.now();
        RetryExecutionResponse response = new RetryExecutionResponse(
                "exec-002", "exec-001", 1, "COMPLETED", now);
        when(executionMonitorService.retry("exec-001")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/executions/exec-001/retry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("exec-002"))
                .andExpect(jsonPath("$.data.retryOf").value("exec-001"))
                .andExpect(jsonPath("$.data.retryCount").value(1))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    @Test
    void retry_shouldReturn422WhenCannotRetry() throws Exception {
        when(executionMonitorService.retry("exec-running"))
                .thenThrow(new ActionException(ErrorCode.EXECUTION_CANNOT_RETRY,
                        "执行状态不允许重试"));

        mockMvc.perform(post("/api/v1/action/executions/exec-running/retry"))
                .andExpect(status().isUnprocessableEntity());
    }

    // =====================================================================
    // 执行步骤
    // =====================================================================

    @Test
    void listSteps_shouldReturnSteps() throws Exception {
        ExecutionStepResponse step = new ExecutionStepResponse(
                "exec-001", "act-001", "queryOrder", "COMPLETED", 120, null);
        when(executionMonitorService.listSteps("exec-001")).thenReturn(List.of(step));

        mockMvc.perform(get("/api/v1/action/executions/exec-001/steps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].stepId").value("exec-001"))
                .andExpect(jsonPath("$.data[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$.data[0].durationMs").value(120));
    }

    // =====================================================================
    // 执行日志
    // =====================================================================

    @Test
    void listLogs_shouldReturnLogs() throws Exception {
        Instant now = Instant.now();
        ExecutionLogResponse log = new ExecutionLogResponse(
                now, "INFO", "queryOrder", "执行开始");
        when(executionMonitorService.listLogs(eq("exec-001"), isNull()))
                .thenReturn(List.of(log));

        mockMvc.perform(get("/api/v1/action/executions/exec-001/logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].level").value("INFO"))
                .andExpect(jsonPath("$.data[0].message").value("执行开始"));
    }

    @Test
    void listLogs_shouldApplyLevelFilter() throws Exception {
        Instant now = Instant.now();
        ExecutionLogResponse log = new ExecutionLogResponse(
                now, "ERROR", "queryOrder", "下游超时");
        when(executionMonitorService.listLogs(eq("exec-001"), eq("ERROR")))
                .thenReturn(List.of(log));

        mockMvc.perform(get("/api/v1/action/executions/exec-001/logs")
                        .param("level", "ERROR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].level").value("ERROR"))
                .andExpect(jsonPath("$.data[0].message").value("下游超时"));
    }
}
