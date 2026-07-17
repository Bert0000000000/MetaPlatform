package com.metaplatform.action.trigger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.HttpExecutionService;
import com.metaplatform.action.trigger.dto.CreateTriggerRequest;
import com.metaplatform.action.trigger.dto.TriggerResponse;
import com.metaplatform.action.trigger.entity.ActionTriggerEntity;
import com.metaplatform.action.trigger.repository.ActionTriggerRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActionTriggerServiceTest {

    @Mock
    private ActionTriggerRepository actionTriggerRepository;

    @Mock
    private ActionDefinitionRepository actionDefinitionRepository;

    @Mock
    private HttpExecutionService httpExecutionService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ActionTriggerService actionTriggerService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenEventTriggerHasEventTopic() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("event-trigger");
        request.setTriggerType("EVENT");
        request.setEventTopic("order.created");

        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(buildAction("act-1", "sendNotification")));
        when(actionTriggerRepository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "event-trigger"))
                .thenReturn(false);
        when(actionTriggerRepository.save(any(ActionTriggerEntity.class))).thenAnswer(i -> i.getArgument(0));

        TriggerResponse response = actionTriggerService.create(request);

        assertThat(response.getTriggerId()).startsWith("trg-");
        assertThat(response.getTriggerType()).isEqualTo("EVENT");
        assertThat(response.getEventTopic()).isEqualTo("order.created");
        assertThat(response.getEnabled()).isTrue();
    }

    @Test
    void create_shouldReturnResponse_whenScheduleTriggerHasCron() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("schedule-trigger");
        request.setTriggerType("SCHEDULE");
        request.setCronExpression("0 * * * * *");

        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(buildAction("act-1", "sendNotification")));
        when(actionTriggerRepository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "schedule-trigger"))
                .thenReturn(false);
        when(actionTriggerRepository.save(any(ActionTriggerEntity.class))).thenAnswer(i -> i.getArgument(0));

        TriggerResponse response = actionTriggerService.create(request);

        assertThat(response.getTriggerType()).isEqualTo("SCHEDULE");
        assertThat(response.getCronExpression()).isEqualTo("0 * * * * *");
    }

    @Test
    void create_shouldReturnResponse_whenManualTrigger() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("manual-trigger");
        request.setTriggerType("MANUAL");

        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(buildAction("act-1", "sendNotification")));
        when(actionTriggerRepository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "manual-trigger"))
                .thenReturn(false);
        when(actionTriggerRepository.save(any(ActionTriggerEntity.class))).thenAnswer(i -> i.getArgument(0));

        TriggerResponse response = actionTriggerService.create(request);

        assertThat(response.getTriggerType()).isEqualTo("MANUAL");
    }

    @Test
    void create_shouldThrow_whenEventTriggerMissingEventTopic() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("event-trigger");
        request.setTriggerType("EVENT");

        assertThatThrownBy(() -> actionTriggerService.create(request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("EVENT 触发器必须指定 eventTopic");
    }

    @Test
    void create_shouldThrow_whenScheduleTriggerMissingCron() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("schedule-trigger");
        request.setTriggerType("SCHEDULE");

        assertThatThrownBy(() -> actionTriggerService.create(request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("SCHEDULE 触发器必须指定 cronExpression");
    }

    @Test
    void create_shouldThrow_whenActionNotFound() {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-missing");
        request.setName("trigger");
        request.setTriggerType("MANUAL");

        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-missing"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> actionTriggerService.create(request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACTION_NOT_FOUND));
    }

    @Test
    void enable_shouldSetEnabledTrue() {
        ActionTriggerEntity entity = buildTrigger("trg-1", "manual-trigger", "MANUAL", false);
        when(actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull("tenant-default", "trg-1"))
                .thenReturn(Optional.of(entity));
        when(actionTriggerRepository.save(any(ActionTriggerEntity.class))).thenAnswer(i -> i.getArgument(0));

        TriggerResponse response = actionTriggerService.enable("trg-1");

        assertThat(response.getEnabled()).isTrue();
    }

    @Test
    void disable_shouldSetEnabledFalse() {
        ActionTriggerEntity entity = buildTrigger("trg-1", "manual-trigger", "MANUAL", true);
        when(actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull("tenant-default", "trg-1"))
                .thenReturn(Optional.of(entity));
        when(actionTriggerRepository.save(any(ActionTriggerEntity.class))).thenAnswer(i -> i.getArgument(0));

        TriggerResponse response = actionTriggerService.disable("trg-1");

        assertThat(response.getEnabled()).isFalse();
    }

    @Test
    void fire_shouldExecuteAction_whenTriggerExists() {
        ActionTriggerEntity entity = buildTrigger("trg-1", "manual-trigger", "MANUAL", true);
        entity.setActionId("act-1");
        when(actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull("tenant-default", "trg-1"))
                .thenReturn(Optional.of(entity));
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(buildAction("act-1", "sendNotification")));
        SyncExecutionResponse execResp = SyncExecutionResponse.builder()
                .executionId("exec-1").actionCode("sendNotification").status("COMPLETED").build();
        when(httpExecutionService.executeSync(any(SyncExecutionRequest.class))).thenReturn(execResp);

        SyncExecutionResponse response = actionTriggerService.fire("trg-1");

        assertThat(response.getExecutionId()).isEqualTo("exec-1");
        ArgumentCaptor<SyncExecutionRequest> captor = ArgumentCaptor.forClass(SyncExecutionRequest.class);
        verify(httpExecutionService).executeSync(captor.capture());
        assertThat(captor.getValue().getActionCode()).isEqualTo("sendNotification");
    }

    @Test
    void get_shouldThrow_whenTriggerNotFoundForTenant() {
        when(actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull("tenant-default", "trg-missing"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> actionTriggerService.get("trg-missing"))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.TRIGGER_NOT_FOUND));
    }

    @Test
    void delete_shouldSoftDelete() {
        ActionTriggerEntity entity = buildTrigger("trg-1", "manual-trigger", "MANUAL", true);
        when(actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull("tenant-default", "trg-1"))
                .thenReturn(Optional.of(entity));
        ArgumentCaptor<ActionTriggerEntity> captor = ArgumentCaptor.forClass(ActionTriggerEntity.class);
        when(actionTriggerRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        actionTriggerService.delete("trg-1");

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private ActionDefinitionEntity buildAction(String actionId, String code) {
        return ActionDefinitionEntity.builder()
                .tenantId("tenant-default")
                .actionId(actionId)
                .code(code)
                .name("发送通知")
                .method("POST")
                .url("https://notify.internal/api/v1/send")
                .headers("{}")
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

    private ActionTriggerEntity buildTrigger(String triggerId, String name, String type, boolean enabled) {
        return ActionTriggerEntity.builder()
                .tenantId("tenant-default")
                .triggerId(triggerId)
                .actionId("act-1")
                .name(name)
                .triggerType(type)
                .config("{}")
                .enabled(enabled)
                .createdBy("system")
                .updatedBy("system")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
