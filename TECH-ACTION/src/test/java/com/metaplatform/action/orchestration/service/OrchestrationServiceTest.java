package com.metaplatform.action.orchestration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.orchestration.dto.CreateOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.OrchestrationListItem;
import com.metaplatform.action.orchestration.dto.OrchestrationResponse;
import com.metaplatform.action.orchestration.dto.UpdateOrchestrationRequest;
import com.metaplatform.action.orchestration.entity.OrchestrationEntity;
import com.metaplatform.action.orchestration.repository.OrchestrationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrchestrationServiceTest {

    @Mock
    private OrchestrationRepository orchestrationRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private GraphValidator graphValidator;

    @InjectMocks
    private OrchestrationService orchestrationService;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenCodeAvailable() {
        CreateOrchestrationRequest request = new CreateOrchestrationRequest();
        request.setCode("orderFlow");
        request.setName("订单流程");
        request.setNodes("[]");
        request.setEdges("[]");

        when(orchestrationRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "orderFlow"))
                .thenReturn(false);
        when(orchestrationRepository.save(any(OrchestrationEntity.class))).thenAnswer(i -> i.getArgument(0));

        OrchestrationResponse response = orchestrationService.create(request);

        assertThat(response.getCode()).isEqualTo("orderFlow");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getOrchestrationId()).startsWith("orch-");
        verify(graphValidator).validate("[]", "[]");
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateOrchestrationRequest request = new CreateOrchestrationRequest();
        request.setCode("orderFlow");
        request.setName("订单流程");

        when(orchestrationRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "orderFlow"))
                .thenReturn(true);

        assertThatThrownBy(() -> orchestrationService.create(request))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("编排 code 在该租户下已存在");
    }

    @Test
    void create_shouldThrow_whenGraphInvalid() {
        CreateOrchestrationRequest request = new CreateOrchestrationRequest();
        request.setCode("orderFlow");
        request.setName("订单流程");
        request.setNodes("[{\"id\":\"n1\"}]");
        request.setEdges("[]");

        when(orchestrationRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "orderFlow"))
                .thenReturn(false);
        doThrow(new ActionException(ErrorCode.INVALID_GRAPH, "节点 type 非法"))
                .when(graphValidator).validate(anyString(), anyString());

        assertThatThrownBy(() -> orchestrationService.create(request))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_GRAPH));
    }

    @Test
    void list_shouldReturnPagedResult() {
        OrchestrationEntity entity = buildEntity("orch-1", "orderFlow", "PUBLISHED", 1);
        Page<OrchestrationEntity> page = new PageImpl<>(List.of(entity));
        when(orchestrationRepository.search(eq("tenant-default"), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<OrchestrationListItem> response = orchestrationService.list(null, null, null, null);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getItems().get(0).getCode()).isEqualTo("orderFlow");
    }

    @Test
    void get_shouldReturnResponse() {
        OrchestrationEntity entity = buildEntity("orch-1", "orderFlow", "PUBLISHED", 2);
        when(orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull("tenant-default", "orch-1"))
                .thenReturn(Optional.of(entity));

        OrchestrationResponse response = orchestrationService.get("orch-1");

        assertThat(response.getOrchestrationId()).isEqualTo("orch-1");
        assertThat(response.getStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    void get_shouldThrow_whenNotFoundForTenant() {
        when(orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull("tenant-default", "orch-missing"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> orchestrationService.get("orch-missing"))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ORCHESTRATION_NOT_FOUND));
    }

    @Test
    void update_shouldUpdateFieldsAndIncrementVersion() {
        OrchestrationEntity entity = buildEntity("orch-1", "orderFlow", "DRAFT", 1);
        when(orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull("tenant-default", "orch-1"))
                .thenReturn(Optional.of(entity));
        when(orchestrationRepository.save(any(OrchestrationEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateOrchestrationRequest request = new UpdateOrchestrationRequest();
        request.setName("订单流程（更新）");

        OrchestrationResponse response = orchestrationService.update("orch-1", request);

        assertThat(response.getName()).isEqualTo("订单流程（更新）");
        assertThat(response.getVersion()).isEqualTo(2);
    }

    @Test
    void delete_shouldSoftDelete() {
        OrchestrationEntity entity = buildEntity("orch-1", "orderFlow", "DRAFT", 1);
        when(orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull("tenant-default", "orch-1"))
                .thenReturn(Optional.of(entity));
        when(orchestrationRepository.save(any(OrchestrationEntity.class))).thenAnswer(i -> i.getArgument(0));

        orchestrationService.delete("orch-1");

        assertThat(entity.getDeletedAt()).isNotNull();
    }

    @Test
    void publish_shouldSetStatusToPublished() {
        OrchestrationEntity entity = buildEntity("orch-1", "orderFlow", "DRAFT", 1);
        when(orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull("tenant-default", "orch-1"))
                .thenReturn(Optional.of(entity));
        when(orchestrationRepository.save(any(OrchestrationEntity.class))).thenAnswer(i -> i.getArgument(0));

        OrchestrationResponse response = orchestrationService.publish("orch-1");

        assertThat(response.getStatus()).isEqualTo("PUBLISHED");
    }

    private OrchestrationEntity buildEntity(String orchestrationId, String code, String status, int version) {
        return OrchestrationEntity.builder()
                .tenantId("tenant-default")
                .orchestrationId(orchestrationId)
                .code(code)
                .name("订单流程")
                .nodes("[]")
                .edges("[]")
                .ruleIntegration("{}")
                .status(status)
                .version(version)
                .createdBy("system")
                .updatedBy("system")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
