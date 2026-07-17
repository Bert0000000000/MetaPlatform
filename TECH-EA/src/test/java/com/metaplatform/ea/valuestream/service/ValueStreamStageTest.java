package com.metaplatform.ea.valuestream.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.valuestream.dto.CreateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.UpdateValueStreamStageRequest;
import com.metaplatform.ea.valuestream.dto.ValueStreamStageResponse;
import com.metaplatform.ea.valuestream.entity.ValueStreamEntity;
import com.metaplatform.ea.valuestream.entity.ValueStreamStageEntity;
import com.metaplatform.ea.valuestream.repository.ValueStreamCapabilityRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamRepository;
import com.metaplatform.ea.valuestream.repository.ValueStreamStageRepository;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ValueStreamStageTest {

    @Mock
    private ValueStreamRepository valueStreamRepository;

    @Mock
    private ValueStreamCapabilityRepository capabilityRepository;

    @Mock
    private ValueStreamStageRepository stageRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ValueStreamService service;

    private UUID valueStreamId;
    private UUID stageId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        valueStreamId = UUID.randomUUID();
        stageId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createStage_shouldDefaultSortOrder() {
        when(valueStreamRepository.findByIdAndDeletedAtIsNull(valueStreamId)).thenReturn(Optional.of(buildValueStream()));
        when(stageRepository.findByValueStreamIdAndDeletedAtIsNullOrderBySortOrderAsc(valueStreamId))
                .thenReturn(List.of());
        ArgumentCaptor<ValueStreamStageEntity> captor = ArgumentCaptor.forClass(ValueStreamStageEntity.class);
        when(stageRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        CreateValueStreamStageRequest request = new CreateValueStreamStageRequest();
        request.setName("开发");
        request.setDescription("需求开发阶段");

        ValueStreamStageResponse response = service.createStage(valueStreamId, request);

        assertThat(captor.getValue().getSortOrder()).isEqualTo(0);
        assertThat(response.getName()).isEqualTo("开发");
    }

    @Test
    void createStage_shouldThrow_whenDuplicateName() {
        when(valueStreamRepository.findByIdAndDeletedAtIsNull(valueStreamId)).thenReturn(Optional.of(buildValueStream()));
        ValueStreamStageEntity existing = buildStage(UUID.randomUUID(), "开发");
        when(stageRepository.findByValueStreamIdAndDeletedAtIsNullOrderBySortOrderAsc(valueStreamId))
                .thenReturn(List.of(existing));

        CreateValueStreamStageRequest request = new CreateValueStreamStageRequest();
        request.setName("开发");

        assertThatThrownBy(() -> service.createStage(valueStreamId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("阶段名称在该价值流下已存在");
    }

    @Test
    void listStages_shouldReturnSortedBySortOrder() {
        when(valueStreamRepository.findByIdAndDeletedAtIsNull(valueStreamId)).thenReturn(Optional.of(buildValueStream()));
        when(stageRepository.findByValueStreamIdAndDeletedAtIsNullOrderBySortOrderAsc(valueStreamId))
                .thenReturn(List.of(buildStage(UUID.randomUUID(), "step1"), buildStage(UUID.randomUUID(), "step2")));

        List<ValueStreamStageResponse> result = service.listStages(valueStreamId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("step1");
    }

    @Test
    void updateStage_shouldModifyFields() {
        ValueStreamStageEntity entity = buildStage(stageId, "开发");
        when(stageRepository.findByIdAndDeletedAtIsNull(stageId)).thenReturn(Optional.of(entity));
        when(stageRepository.save(any(ValueStreamStageEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateValueStreamStageRequest request = new UpdateValueStreamStageRequest();
        request.setName("需求开发");
        request.setSortOrder(2);

        ValueStreamStageResponse response = service.updateStage(valueStreamId, stageId, request);

        assertThat(response.getName()).isEqualTo("需求开发");
        assertThat(response.getSortOrder()).isEqualTo(2);
    }

    @Test
    void updateStage_shouldThrow_whenStageNotInValueStream() {
        ValueStreamStageEntity entity = buildStage(stageId, "开发");
        entity.setValueStreamId(UUID.randomUUID());
        when(stageRepository.findByIdAndDeletedAtIsNull(stageId)).thenReturn(Optional.of(entity));

        UpdateValueStreamStageRequest request = new UpdateValueStreamStageRequest();
        request.setName("new");

        assertThatThrownBy(() -> service.updateStage(valueStreamId, stageId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("不属于");
    }

    @Test
    void deleteStage_shouldSoftDelete() {
        ValueStreamStageEntity entity = buildStage(stageId, "开发");
        when(stageRepository.findByIdAndDeletedAtIsNull(stageId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<ValueStreamStageEntity> captor = ArgumentCaptor.forClass(ValueStreamStageEntity.class);
        when(stageRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.deleteStage(valueStreamId, stageId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private ValueStreamEntity buildValueStream() {
        return ValueStreamEntity.builder()
                .id(valueStreamId)
                .tenantId("tenant-default")
                .name("订单交付")
                .code("ORDER_DELIVERY")
                .stages("[]")
                .status("ACTIVE")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private ValueStreamStageEntity buildStage(UUID id, String name) {
        return ValueStreamStageEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .valueStreamId(valueStreamId)
                .name(name)
                .sortOrder(0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}