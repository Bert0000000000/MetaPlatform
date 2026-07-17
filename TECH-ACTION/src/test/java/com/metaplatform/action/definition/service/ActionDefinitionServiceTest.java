package com.metaplatform.action.definition.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.definition.dto.ActionDefinitionListItem;
import com.metaplatform.action.definition.dto.ActionDefinitionResponse;
import com.metaplatform.action.definition.dto.CreateActionDefinitionRequest;
import com.metaplatform.action.definition.dto.UpdateActionDefinitionRequest;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActionDefinitionServiceTest {

    @Mock
    private ActionDefinitionRepository actionDefinitionRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ActionDefinitionService actionDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenCodeIsAvailable() {
        CreateActionDefinitionRequest request = new CreateActionDefinitionRequest();
        request.setCode("sendNotification");
        request.setName("发送通知");
        request.setMethod("POST");
        request.setUrl("https://notify.internal/api/v1/send");
        request.setInputSchema("{\"type\":\"object\"}");
        request.setOutputSchema("{\"type\":\"object\"}");

        when(actionDefinitionRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(false);
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        ActionDefinitionResponse response = actionDefinitionService.create(request);

        assertThat(response.getCode()).isEqualTo("sendNotification");
        assertThat(response.getName()).isEqualTo("发送通知");
        assertThat(response.getMethod()).isEqualTo("POST");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getActionId()).startsWith("act-");
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateActionDefinitionRequest request = new CreateActionDefinitionRequest();
        request.setCode("sendNotification");
        request.setName("发送通知");
        request.setMethod("POST");
        request.setUrl("https://notify.internal/api/v1/send");
        request.setInputSchema("{\"type\":\"object\"}");
        request.setOutputSchema("{\"type\":\"object\"}");

        when(actionDefinitionRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(true);

        assertThatThrownBy(() -> actionDefinitionService.create(request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("Action code 在该租户下已存在");
    }

    @Test
    void create_shouldNormalizeEmptyHeadersToDefault() {
        CreateActionDefinitionRequest request = new CreateActionDefinitionRequest();
        request.setCode("sendNotification");
        request.setName("发送通知");
        request.setMethod("POST");
        request.setUrl("https://notify.internal/api/v1/send");
        request.setHeaders(null);
        request.setInputSchema("{\"type\":\"object\"}");
        request.setOutputSchema("{\"type\":\"object\"}");

        when(actionDefinitionRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "sendNotification"))
                .thenReturn(false);
        ArgumentCaptor<ActionDefinitionEntity> captor = ArgumentCaptor.forClass(ActionDefinitionEntity.class);
        when(actionDefinitionRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        actionDefinitionService.create(request);

        assertThat(captor.getValue().getHeaders()).isEqualTo("{}");
    }

    @Test
    void list_shouldReturnPagedResult() {
        ActionDefinitionEntity entity = ActionDefinitionEntity.builder()
                .actionId("act-1")
                .code("sendNotification")
                .name("发送通知")
                .status("PUBLISHED")
                .version(2)
                .build();
        Page<ActionDefinitionEntity> page = new PageImpl<>(List.of(entity));
        when(actionDefinitionRepository.search(eq("tenant-default"), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<ActionDefinitionListItem> response = actionDefinitionService.list(null, null, null, null);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getPage()).isEqualTo(1);
        assertThat(response.getSize()).isEqualTo(20);
        assertThat(response.getItems().get(0).getCode()).isEqualTo("sendNotification");
    }

    @Test
    void get_shouldReturnResponse() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DRAFT", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        ActionDefinitionResponse response = actionDefinitionService.get("act-1");

        assertThat(response.getActionId()).isEqualTo("act-1");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void get_shouldThrow_whenNotFound() {
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> actionDefinitionService.get("act-1"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("Action 不存在");
    }

    @Test
    void update_shouldUpdateFieldsAndReturnResponse() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DRAFT", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateActionDefinitionRequest request = new UpdateActionDefinitionRequest();
        request.setName("发送通知（更新版）");
        request.setMethod("GET");
        request.setHeaders("{\"X-Custom\":\"1\"}");
        request.setInputSchema("{\"type\":\"object\"}");

        ActionDefinitionResponse response = actionDefinitionService.update("act-1", request);

        assertThat(response.getName()).isEqualTo("发送通知（更新版）");
        assertThat(response.getMethod()).isEqualTo("GET");
        assertThat(response.getVersion()).isEqualTo(2);
    }

    @Test
    void update_shouldRevertPublishedToDraft() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "PUBLISHED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateActionDefinitionRequest request = new UpdateActionDefinitionRequest();
        request.setName("发送通知（更新版）");

        ActionDefinitionResponse response = actionDefinitionService.update("act-1", request);

        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getVersion()).isEqualTo(2);
    }

    @Test
    void update_shouldThrow_whenDisabled() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DISABLED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        UpdateActionDefinitionRequest request = new UpdateActionDefinitionRequest();
        request.setName("发送通知（更新版）");

        assertThatThrownBy(() -> actionDefinitionService.update("act-1", request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("已禁用的 Action 不可更新");
    }

    @Test
    void delete_shouldSoftDelete() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DRAFT", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));
        ArgumentCaptor<ActionDefinitionEntity> captor = ArgumentCaptor.forClass(ActionDefinitionEntity.class);
        when(actionDefinitionRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        actionDefinitionService.delete("act-1");

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void publish_shouldSetStatusToPublished() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DRAFT", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        ActionDefinitionResponse response = actionDefinitionService.publish("act-1");

        assertThat(response.getStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    void publish_shouldThrow_whenAlreadyPublished() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "PUBLISHED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> actionDefinitionService.publish("act-1"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("Action 已发布");
    }

    @Test
    void publish_shouldThrow_whenDisabled() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DISABLED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> actionDefinitionService.publish("act-1"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("已禁用的 Action 不可直接发布");
    }

    @Test
    void disable_shouldSetStatusToDisabled() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "PUBLISHED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        ActionDefinitionResponse response = actionDefinitionService.disable("act-1");

        assertThat(response.getStatus()).isEqualTo("DISABLED");
    }

    @Test
    void disable_shouldThrow_whenDraft() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DRAFT", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> actionDefinitionService.disable("act-1"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("草稿状态的 Action 不可禁用");
    }

    @Test
    void disable_shouldThrow_whenAlreadyDisabled() {
        ActionDefinitionEntity entity = buildEntity("act-1", "sendNotification", "DISABLED", 1);
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> actionDefinitionService.disable("act-1"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("Action 已禁用");
    }

    private ActionDefinitionEntity buildEntity(String actionId, String code, String status, int version) {
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
                .status(status)
                .version(version)
                .createdBy("system")
                .updatedBy("system")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
