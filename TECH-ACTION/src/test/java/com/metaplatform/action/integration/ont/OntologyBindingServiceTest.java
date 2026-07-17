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

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
        when(ontologyIntegrationService.validateEntity("ent-input")).thenReturn(true);
        when(ontologyIntegrationService.validateEntity("ent-output")).thenReturn(true);
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
        when(ontologyIntegrationService.validateEntity("ent-input"))
                .thenThrow(new ActionException(ErrorCode.DEPENDENCY_ERROR, "TECH-ONT 实体校验失败: connection refused"));

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
