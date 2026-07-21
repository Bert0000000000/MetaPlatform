package com.metaplatform.ea.techradar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techradar.dto.CreateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.dto.TechnologyRadarItem;
import com.metaplatform.ea.techradar.dto.TechnologyRadarResponse;
import com.metaplatform.ea.techradar.dto.UpdateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.entity.TechnologyRadarEntity;
import com.metaplatform.ea.techradar.repository.TechnologyRadarRepository;
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
class TechnologyRadarServiceTest {

    @Mock
    private TechnologyRadarRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private TechnologyRadarService service;

    private UUID radarId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        radarId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldUseDefaultQuadrantsAndRings() {
        CreateTechnologyRadarRequest request = new CreateTechnologyRadarRequest();
        request.setName("Mate 技术雷达");

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "Mate 技术雷达"))
                .thenReturn(false);
        ArgumentCaptor<TechnologyRadarEntity> captor = ArgumentCaptor.forClass(TechnologyRadarEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        TechnologyRadarResponse response = service.create(request);

        assertThat(response.getQuadrants()).hasSize(4);
        assertThat(response.getRings()).hasSize(4);
        assertThat(response.getItems()).isEmpty();
    }

    @Test
    void create_shouldSerializeItems() {
        CreateTechnologyRadarRequest request = new CreateTechnologyRadarRequest();
        request.setName("Mate 技术雷达");
        TechnologyRadarItem item = new TechnologyRadarItem();
        item.setId(UUID.randomUUID().toString());
        item.setName("Spring Boot");
        item.setQuadrant("语言与框架");
        item.setRing("采纳");
        item.setTrend("stable");
        request.setItems(List.of(item));

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "Mate 技术雷达"))
                .thenReturn(false);
        when(repository.save(any(TechnologyRadarEntity.class))).thenAnswer(i -> i.getArgument(0));

        TechnologyRadarResponse response = service.create(request);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().get(0).getName()).isEqualTo("Spring Boot");
    }

    @Test
    void create_shouldThrow_whenDuplicateName() {
        CreateTechnologyRadarRequest request = new CreateTechnologyRadarRequest();
        request.setName("Mate 技术雷达");

        when(repository.existsByTenantIdAndNameAndDeletedAtIsNull("tenant-default", "Mate 技术雷达"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("已存在同名技术雷达");
    }

    @Test
    void update_shouldReplaceItems() {
        TechnologyRadarEntity entity = buildEntity(radarId, "Mate 技术雷达");
        when(repository.findByIdAndDeletedAtIsNull(radarId)).thenReturn(Optional.of(entity));
        when(repository.save(any(TechnologyRadarEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateTechnologyRadarRequest request = new UpdateTechnologyRadarRequest();
        TechnologyRadarItem item = new TechnologyRadarItem();
        item.setName("Kafka");
        item.setQuadrant("平台与基础设施");
        item.setRing("试用");
        request.setItems(List.of(item));

        TechnologyRadarResponse response = service.update(radarId, request);

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().get(0).getName()).isEqualTo("Kafka");
    }

    @Test
    void delete_shouldSoftDelete() {
        TechnologyRadarEntity entity = buildEntity(radarId, "Mate 技术雷达");
        when(repository.findByIdAndDeletedAtIsNull(radarId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<TechnologyRadarEntity> captor = ArgumentCaptor.forClass(TechnologyRadarEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(radarId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    private TechnologyRadarEntity buildEntity(UUID id, String name) {
        return TechnologyRadarEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(name)
                .quadrants("[\"语言与框架\",\"数据与存储\",\"平台与基础设施\",\"工具与流程\"]")
                .rings("[\"采纳\",\"试用\",\"评估\",\"暂缓\"]")
                .items("[]")
                .status("active")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
