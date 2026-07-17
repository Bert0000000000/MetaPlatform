package com.metaplatform.ea.process.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.process.dto.BusinessProcessResponse;
import com.metaplatform.ea.process.dto.BusinessProcessVersionResponse;
import com.metaplatform.ea.process.dto.CreateProcessVersionRequest;
import com.metaplatform.ea.process.dto.UpdateBusinessProcessRequest;
import com.metaplatform.ea.process.entity.BusinessProcessEntity;
import com.metaplatform.ea.process.entity.BusinessProcessVersionEntity;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import com.metaplatform.ea.process.repository.BusinessProcessVersionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BusinessProcessVersionTest {

    @Mock
    private BusinessProcessRepository repository;

    @Mock
    private BusinessProcessVersionRepository versionRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private BusinessProcessService service;

    private UUID processId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        processId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createVersion_shouldIncrementVersion() {
        BusinessProcessEntity entity = buildProcess(processId, 1, "[]");
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<BusinessProcessVersionEntity> captor = ArgumentCaptor.forClass(BusinessProcessVersionEntity.class);
        when(versionRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        CreateProcessVersionRequest request = new CreateProcessVersionRequest();
        request.setProcessSteps(List.of(Map.of("id", "step-1", "name", "开始")));
        request.setChangeNote("新增审批环节");

        BusinessProcessVersionResponse response = service.createVersion(processId, request);

        assertThat(captor.getValue().getVersion()).isEqualTo(2);
        assertThat(response.getVersion()).isEqualTo(2);
        assertThat(response.getChangeNote()).isEqualTo("新增审批环节");
    }

    @Test
    void listVersions_shouldReturnOrderedByVersionDesc() {
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(buildProcess(processId, 2, "[]")));
        when(versionRepository.findByProcessIdOrderByVersionDesc(processId))
                .thenReturn(List.of(buildVersion(UUID.randomUUID(), 2), buildVersion(UUID.randomUUID(), 1)));

        List<BusinessProcessVersionResponse> result = service.listVersions(processId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getVersion()).isEqualTo(2);
    }

    @Test
    void getVersion_shouldThrow_whenNotFound() {
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(buildProcess(processId, 1, "[]")));
        when(versionRepository.findByProcessIdAndVersion(processId, 99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVersion(processId, 99))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("流程版本不存在");
    }

    @Test
    void update_shouldIncrementVersion_whenStepsChanged() {
        BusinessProcessEntity entity = buildProcess(processId, 1, "[{\"id\":\"s1\",\"name\":\"开始\"}]");
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(entity));
        when(repository.save(any(BusinessProcessEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateBusinessProcessRequest request = new UpdateBusinessProcessRequest();
        request.setProcessSteps(List.of(Map.of("id", "s1", "name", "审批"), Map.of("id", "s2", "name", "结束")));

        BusinessProcessResponse response = service.update(processId, request);

        assertThat(response.getVersion()).isEqualTo(2);
        assertThat(response.getProcessSteps()).hasSize(2);
    }

    @Test
    void getFlowchart_shouldBuildNodesAndEdges() {
        String steps = "[{\"id\":\"s1\",\"name\":\"开始\",\"type\":\"start\"},{\"id\":\"s2\",\"name\":\"审批\",\"type\":\"task\"}]";
        BusinessProcessEntity entity = buildProcess(processId, 1, steps);
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(entity));

        Map<String, Object> flowchart = service.getFlowchart(processId);

        assertThat(flowchart).containsKey("nodes");
        assertThat(flowchart).containsKey("edges");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) flowchart.get("nodes");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) flowchart.get("edges");
        assertThat(nodes).hasSize(2);
        assertThat(edges).hasSize(1);
    }

    @Test
    void delete_shouldSoftDelete() {
        BusinessProcessEntity entity = buildProcess(processId, 1, "[]");
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<BusinessProcessEntity> captor = ArgumentCaptor.forClass(BusinessProcessEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(processId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private BusinessProcessEntity buildProcess(UUID id, int version, String stepsJson) {
        return BusinessProcessEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("订单处理流程")
                .code("ORDER_PROCESS")
                .description("订单端到端处理")
                .capabilities("[]")
                .processSteps(stepsJson)
                .version(version)
                .status("DRAFT")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private BusinessProcessVersionEntity buildVersion(UUID id, int version) {
        return BusinessProcessVersionEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .processId(processId)
                .version(version)
                .processSteps("[]")
                .flowchart("{}")
                .changeNote("note")
                .createdAt(Instant.now())
                .build();
    }
}