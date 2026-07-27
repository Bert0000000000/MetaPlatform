package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataFlowRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataFlowResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataFlowRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataEntityEntity;
import com.metaplatform.ea.dataarchitecture.entity.DataFlowEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataFlowRepository;
import com.metaplatform.ea.exception.EaException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataFlowServiceTest {

    @Mock
    private DataFlowRepository flowRepository;

    @Mock
    private DataEntityRepository entityRepository;

    @InjectMocks
    private DataFlowService service;

    private UUID sourceId;
    private UUID targetId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        sourceId = UUID.randomUUID();
        targetId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistFlow_whenEntitiesExist() {
        CreateDataFlowRequest request = new CreateDataFlowRequest();
        request.setName("客户订单同步");
        request.setSourceEntityId(sourceId);
        request.setTargetEntityId(targetId);
        request.setFlowType("REALTIME");
        request.setSchedule("@hourly");

        when(entityRepository.findByIdAndDeletedAtIsNull(sourceId)).thenReturn(Optional.of(buildEntity(sourceId)));
        when(entityRepository.findByIdAndDeletedAtIsNull(targetId)).thenReturn(Optional.of(buildEntity(targetId)));
        ArgumentCaptor<DataFlowEntity> captor = ArgumentCaptor.forClass(DataFlowEntity.class);
        when(flowRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DataFlowResponse response = service.create(request);

        assertThat(captor.getValue().getTenantId()).isEqualTo("tenant-default");
        assertThat(captor.getValue().getFlowType()).isEqualTo("REALTIME");
        assertThat(response.getName()).isEqualTo("客户订单同步");
        assertThat(response.getSchedule()).isEqualTo("@hourly");
    }

    @Test
    void create_shouldThrow_whenSourceMissing() {
        CreateDataFlowRequest request = new CreateDataFlowRequest();
        request.setName("missing");
        request.setSourceEntityId(sourceId);
        request.setTargetEntityId(targetId);

        when(entityRepository.findByIdAndDeletedAtIsNull(sourceId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("源数据实体不存在");
    }

    @Test
    void create_shouldThrow_whenTargetMissing() {
        CreateDataFlowRequest request = new CreateDataFlowRequest();
        request.setName("missing");
        request.setSourceEntityId(sourceId);
        request.setTargetEntityId(targetId);

        when(entityRepository.findByIdAndDeletedAtIsNull(sourceId)).thenReturn(Optional.of(buildEntity(sourceId)));
        when(entityRepository.findByIdAndDeletedAtIsNull(targetId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("目标数据实体不存在");
    }

    @Test
    void list_shouldReturnTenantScopedFlows() {
        DataFlowEntity entity = DataFlowEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("客户订单同步")
                .sourceEntityId(sourceId)
                .targetEntityId(targetId)
                .flowType("REALTIME")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        when(flowRepository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<DataFlowResponse> result = service.list();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSourceEntityId()).isEqualTo(sourceId);
    }

    @Test
    void update_shouldChangeFlowType() {
        DataFlowEntity entity = DataFlowEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("flow")
                .sourceEntityId(sourceId)
                .targetEntityId(targetId)
                .flowType("BATCH")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        when(flowRepository.findById(entity.getId())).thenReturn(Optional.of(entity));
        when(flowRepository.save(any(DataFlowEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDataFlowRequest request = new UpdateDataFlowRequest();
        request.setFlowType("REALTIME");
        request.setSchedule("@daily");

        DataFlowResponse response = service.update(entity.getId(), request);

        assertThat(response.getFlowType()).isEqualTo("REALTIME");
        assertThat(response.getSchedule()).isEqualTo("@daily");
    }

    @Test
    void delete_shouldSoftDelete() {
        DataFlowEntity entity = DataFlowEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("flow")
                .sourceEntityId(sourceId)
                .targetEntityId(targetId)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        when(flowRepository.findById(entity.getId())).thenReturn(Optional.of(entity));
        ArgumentCaptor<DataFlowEntity> captor = ArgumentCaptor.forClass(DataFlowEntity.class);
        when(flowRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(entity.getId());

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private DataEntityEntity buildEntity(UUID id) {
        return DataEntityEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("entity")
                .code("ENTITY_" + id.toString().substring(0, 8))
                .entityType("MASTER_DATA")
                .attributes("[]")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
