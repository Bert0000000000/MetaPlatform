package com.metaplatform.action.execution.service;

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
import com.metaplatform.action.outbox.service.ActionOutboxService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class HttpExecutionServiceTest {

    @Mock
    private ActionDefinitionRepository actionDefinitionRepository;

    @Mock
    private ExecutionRepository executionRepository;

    @Mock
    private ActionOutboxService actionOutboxService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private HttpExecutionService httpExecutionService;

    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        TraceContext.set("trace-1");

        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        httpExecutionService = new HttpExecutionService(actionDefinitionRepository, executionRepository,
                objectMapper, builder, actionOutboxService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        TraceContext.clear();
    }

    @Test
    void executeSync_shouldReturnResponse_whenActionPublishedAndHttpSucceeds() {
        ActionDefinitionEntity action = buildPublishedAction();
        when(actionDefinitionRepository.findByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(Optional.of(action));
        when(executionRepository.save(any(ExecutionEntity.class))).thenAnswer(i -> i.getArgument(0));

        server.expect(requestTo("https://notify.internal/api/v1/send"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"result\":\"ok\"}", MediaType.APPLICATION_JSON));

        SyncExecutionRequest request = new SyncExecutionRequest();
        request.setActionCode("sendNotification");
        request.setInput(Map.of("message", "hello"));

        SyncExecutionResponse response = httpExecutionService.executeSync(request);

        assertThat(response.getActionCode()).isEqualTo("sendNotification");
        assertThat(response.getStatus()).isEqualTo("COMPLETED");
        assertThat(response.getOutput()).isNotNull();
        server.verify();

        ArgumentCaptor<ExecutionEntity> captor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository, atLeast(2)).save(captor.capture());
        ExecutionEntity completed = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertThat(completed.getStatus()).isEqualTo("COMPLETED");
        assertThat(completed.getTraceId()).isEqualTo("trace-1");
    }

    @Test
    void executeSync_shouldThrow_whenActionNotFound() {
        when(actionDefinitionRepository.findByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "missing"))
                .thenReturn(Optional.empty());

        SyncExecutionRequest request = new SyncExecutionRequest();
        request.setActionCode("missing");

        assertThatThrownBy(() -> httpExecutionService.executeSync(request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> {
                    ActionException ae = (ActionException) e;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.ACTION_NOT_FOUND);
                });
    }

    @Test
    void executeSync_shouldThrow_whenActionNotPublished() {
        ActionDefinitionEntity action = buildPublishedAction();
        action.setStatus("DRAFT");
        when(actionDefinitionRepository.findByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(Optional.of(action));

        SyncExecutionRequest request = new SyncExecutionRequest();
        request.setActionCode("sendNotification");

        assertThatThrownBy(() -> httpExecutionService.executeSync(request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> {
                    ActionException ae = (ActionException) e;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.ACTION_NOT_PUBLISHED);
                });
    }

    @Test
    void executeSync_shouldRecordFailedExecution_whenHttpFails() {
        ActionDefinitionEntity action = buildPublishedAction();
        when(actionDefinitionRepository.findByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(Optional.of(action));
        when(executionRepository.save(any(ExecutionEntity.class))).thenAnswer(i -> i.getArgument(0));

        server.expect(requestTo("https://notify.internal/api/v1/send"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError().body("Internal Server Error"));

        SyncExecutionRequest request = new SyncExecutionRequest();
        request.setActionCode("sendNotification");
        request.setInput(Map.of("message", "hello"));

        assertThatThrownBy(() -> httpExecutionService.executeSync(request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> {
                    ActionException ae = (ActionException) e;
                    assertThat(ae.getErrorCode()).isEqualTo(ErrorCode.HTTP_EXECUTION_ERROR);
                });
        server.verify();

        ArgumentCaptor<ExecutionEntity> captor = ArgumentCaptor.forClass(ExecutionEntity.class);
        verify(executionRepository, atLeast(2)).save(captor.capture());
        ExecutionEntity failed = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertThat(failed.getStatus()).isEqualTo("FAILED");
        assertThat(failed.getErrorCode()).isEqualTo(String.valueOf(ErrorCode.HTTP_EXECUTION_ERROR.getCode()));
    }

    private ActionDefinitionEntity buildPublishedAction() {
        return ActionDefinitionEntity.builder()
                .tenantId("tenant-default")
                .actionId("act-1")
                .code("sendNotification")
                .name("发送通知")
                .method("POST")
                .url("https://notify.internal/api/v1/send")
                .headers("{\"Content-Type\":\"application/json\"}")
                .inputSchema("{\"type\":\"object\"}")
                .outputSchema("{\"type\":\"object\"}")
                .status("PUBLISHED")
                .version(1)
                .createdBy("system")
                .updatedBy("system")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
