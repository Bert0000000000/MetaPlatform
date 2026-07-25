package com.metaplatform.action.integration.ont;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.integration.ont.dto.OntologyBindingRequest;
import com.metaplatform.action.integration.ont.dto.OntologyBindingResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OntologyBindingServiceTest {

    @Mock
    private ActionDefinitionRepository actionDefinitionRepository;

    @Mock
    private OntologyIntegrationService ontologyIntegrationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OntologyBindingService ontologyBindingService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        ontologyBindingService = new OntologyBindingService(
                actionDefinitionRepository, ontologyIntegrationService, objectMapper);
        // 模拟 @Value 注入：inputEntityRequired=true（与 application-dev.yml 默认一致）
        ReflectionTestUtils.setField(ontologyBindingService, "inputEntityRequired", true);
        ReflectionTestUtils.setField(ontologyBindingService, "outputEntityRequired", false);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void bind_shouldSaveBinding_whenValid() {
        ActionDefinitionEntity action = buildAction("act-1");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));
        doNothing().when(ontologyIntegrationService).validateEntity(eq("ent-input"), eq(true));
        doNothing().when(ontologyIntegrationService).validateEntity(eq("ent-output"), eq(false));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        OntologyBindingRequest request = new OntologyBindingRequest();
        request.setInputEntityId("ent-input");
        request.setOutputEntityId("ent-output");
        OntologyBindingRequest.FieldMapping mapping = new OntologyBindingRequest.FieldMapping();
        mapping.setSource("orderId");
        mapping.setTarget("order.id");
        request.setFieldMappings(List.of(mapping));

        OntologyBindingResponse response = ontologyBindingService.bind("act-1", request);

        assertThat(response.getActionId()).isEqualTo("act-1");
        assertThat(response.getInputEntityId()).isEqualTo("ent-input");
        assertThat(response.getOutputEntityId()).isEqualTo("ent-output");
        assertThat(response.getFieldMappings()).hasSize(1);
        ArgumentCaptor<ActionDefinitionEntity> captor = ArgumentCaptor.forClass(ActionDefinitionEntity.class);
        verify(actionDefinitionRepository).save(captor.capture());
        assertThat(captor.getValue().getOntologyBinding()).contains("ent-input");
    }

    @Test
    void getBinding_shouldReturnBinding_whenExists() {
        ActionDefinitionEntity action = buildAction("act-1");
        action.setOntologyBinding("{\"inputEntityId\":\"ent-input\",\"outputEntityId\":\"ent-output\","
                + "\"fieldMappings\":[{\"source\":\"orderId\",\"target\":\"order.id\"}]}");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));

        OntologyBindingResponse response = ontologyBindingService.getBinding("act-1");

        assertThat(response.getActionId()).isEqualTo("act-1");
        assertThat(response.getInputEntityId()).isEqualTo("ent-input");
        assertThat(response.getOutputEntityId()).isEqualTo("ent-output");
        assertThat(response.getFieldMappings()).hasSize(1);
        assertThat(response.getFieldMappings().get(0).getSource()).isEqualTo("orderId");
    }

    @Test
    void bind_shouldThrow_whenFieldMappingsEmpty() {
        ActionDefinitionEntity action = buildAction("act-1");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));

        OntologyBindingRequest request = new OntologyBindingRequest();
        request.setInputEntityId("ent-input");
        request.setOutputEntityId("ent-output");
        request.setFieldMappings(List.of());

        assertThatThrownBy(() -> ontologyBindingService.bind("act-1", request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("fieldMappings 不能为空");
    }

    @Test
    void bind_shouldThrow_whenOntUnavailable() {
        ActionDefinitionEntity action = buildAction("act-1");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));
        doThrow(new ActionException(ErrorCode.DEPENDENCY_ERROR, "TECH-ONT 实体校验失败: connection refused"))
                .when(ontologyIntegrationService).validateEntity(eq("ent-input"), eq(true));

        OntologyBindingRequest request = new OntologyBindingRequest();
        request.setInputEntityId("ent-input");
        request.setOutputEntityId("ent-output");
        OntologyBindingRequest.FieldMapping mapping = new OntologyBindingRequest.FieldMapping();
        mapping.setSource("orderId");
        mapping.setTarget("order.id");
        request.setFieldMappings(List.of(mapping));

        assertThatThrownBy(() -> ontologyBindingService.bind("act-1", request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.DEPENDENCY_ERROR));
    }

    @Test
    void bind_shouldThrow_whenActionNotFound() {
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-missing"))
                .thenReturn(Optional.empty());

        OntologyBindingRequest request = new OntologyBindingRequest();
        OntologyBindingRequest.FieldMapping mapping = new OntologyBindingRequest.FieldMapping();
        mapping.setSource("orderId");
        mapping.setTarget("order.id");
        request.setFieldMappings(List.of(mapping));

        assertThatThrownBy(() -> ontologyBindingService.bind("act-missing", request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ACTION_NOT_FOUND));
    }

    @Test
    void bind_shouldThrow_whenInputEntityIdMissingAndRequired() {
        // inputEntityRequired=true, outputEntityRequired=false (from setUp)
        ActionDefinitionEntity action = buildAction("act-1");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));
        doThrow(new ActionException(ErrorCode.MISSING_REQUIRED_FIELD, "entityId 不能为空（必填绑定）"))
                .when(ontologyIntegrationService).validateEntity(eq(null), eq(true));

        OntologyBindingRequest request = new OntologyBindingRequest();
        request.setInputEntityId(null); // 必填但为空
        request.setOutputEntityId("ent-output");
        OntologyBindingRequest.FieldMapping mapping = new OntologyBindingRequest.FieldMapping();
        mapping.setSource("orderId");
        mapping.setTarget("order.id");
        request.setFieldMappings(List.of(mapping));

        assertThatThrownBy(() -> ontologyBindingService.bind("act-1", request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.MISSING_REQUIRED_FIELD));
        // inputEntity 校验失败后不应继续校验 outputEntity（短路）
        verify(ontologyIntegrationService, never())
                .validateEntity(eq("ent-output"), anyBoolean());
    }

    @Test
    void bind_shouldSkipValidation_whenOutputEntityIdMissingAndOptional() {
        // inputEntityRequired=true, outputEntityRequired=false (from setUp)
        ActionDefinitionEntity action = buildAction("act-1");
        when(actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull("tenant-default", "act-1"))
                .thenReturn(Optional.of(action));
        doNothing().when(ontologyIntegrationService).validateEntity(eq("ent-input"), eq(true));
        doNothing().when(ontologyIntegrationService).validateEntity(eq(null), eq(false));
        when(actionDefinitionRepository.save(any(ActionDefinitionEntity.class))).thenAnswer(i -> i.getArgument(0));

        OntologyBindingRequest request = new OntologyBindingRequest();
        request.setInputEntityId("ent-input");
        request.setOutputEntityId(null); // 可选，为空跳过校验
        OntologyBindingRequest.FieldMapping mapping = new OntologyBindingRequest.FieldMapping();
        mapping.setSource("orderId");
        mapping.setTarget("order.id");
        request.setFieldMappings(List.of(mapping));

        OntologyBindingResponse response = ontologyBindingService.bind("act-1", request);

        assertThat(response.getActionId()).isEqualTo("act-1");
        assertThat(response.getInputEntityId()).isEqualTo("ent-input");
        assertThat(response.getOutputEntityId()).isNull();
        // inputEntity（必填）与 outputEntity（可选，空值跳过）的校验都应被调用
        verify(ontologyIntegrationService).validateEntity(eq("ent-input"), eq(true));
        verify(ontologyIntegrationService).validateEntity(eq(null), eq(false));
    }

    private ActionDefinitionEntity buildAction(String actionId) {
        return ActionDefinitionEntity.builder()
                .tenantId("tenant-default")
                .actionId(actionId)
                .code("sendNotification")
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
}
