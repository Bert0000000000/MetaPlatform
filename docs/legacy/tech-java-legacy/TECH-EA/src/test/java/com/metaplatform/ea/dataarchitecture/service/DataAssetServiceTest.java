package com.metaplatform.ea.dataarchitecture.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetCatalogResponse;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataAssetEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataAssetRepository;
import com.metaplatform.ea.exception.EaException;
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
class DataAssetServiceTest {

    @Mock
    private DataAssetRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DataAssetService service;

    private UUID assetId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        assetId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistAsset() {
        CreateDataAssetRequest request = new CreateDataAssetRequest();
        request.setName("客户宽表");
        request.setCode("CUSTOMER_WIDE_TABLE");
        request.setAssetType("TABLE");
        request.setClassification("L2");
        request.setTags(List.of("客户域", "核心"));

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER_WIDE_TABLE"))
                .thenReturn(false);
        ArgumentCaptor<DataAssetEntity> captor = ArgumentCaptor.forClass(DataAssetEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        DataAssetResponse response = service.create(request);

        assertThat(captor.getValue().getClassification()).isEqualTo("L2");
        assertThat(captor.getValue().getAssetType()).isEqualTo("TABLE");
        assertThat(captor.getValue().getTags()).contains("客户域");
        assertThat(response.getMetadata()).isEqualTo("{}");
        assertThat(response.getTags()).containsExactly("客户域", "核心");
    }

    @Test
    void create_shouldThrow_whenDuplicateCode() {
        CreateDataAssetRequest request = new CreateDataAssetRequest();
        request.setName("客户宽表");
        request.setCode("CUSTOMER_WIDE_TABLE");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "CUSTOMER_WIDE_TABLE"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("数据资产编码已存在");
    }

    @Test
    void list_shouldReturnAssets() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<DataAssetResponse> result = service.list(null, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("CUSTOMER_WIDE_TABLE");
    }

    @Test
    void list_shouldFilterByKeyword() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        List<DataAssetResponse> result = service.list("其他", null, null);

        assertThat(result).isEmpty();
    }

    @Test
    void update_shouldUpdateClassification() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(entity));
        when(repository.save(any(DataAssetEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateDataAssetRequest request = new UpdateDataAssetRequest();
        request.setClassification("L4");
        request.setDescription("sensitive");
        request.setTags(List.of("敏感"));

        DataAssetResponse response = service.update(assetId, request);

        assertThat(response.getClassification()).isEqualTo("L4");
        assertThat(response.getDescription()).isEqualTo("sensitive");
        assertThat(response.getTags()).containsExactly("敏感");
    }

    @Test
    void delete_shouldSoftDelete() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByIdAndDeletedAtIsNull(assetId)).thenReturn(Optional.of(entity));
        ArgumentCaptor<DataAssetEntity> captor = ArgumentCaptor.forClass(DataAssetEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        service.delete(assetId);

        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void catalog_shouldGroupByType() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        DataAssetCatalogResponse response = service.catalog("type");

        assertThat(response.getGroupBy()).isEqualTo("type");
        assertThat(response.getGroups()).hasSize(1);
        assertThat(response.getGroups().get(0).getKey()).isEqualTo("TABLE");
        assertThat(response.getGroups().get(0).getAssets()).hasSize(1);
    }

    @Test
    void catalog_shouldGroupByTag() {
        DataAssetEntity entity = buildEntity(assetId);
        when(repository.findByTenantIdAndDeletedAtIsNull("tenant-default")).thenReturn(List.of(entity));

        DataAssetCatalogResponse response = service.catalog("tag");

        assertThat(response.getGroupBy()).isEqualTo("tag");
        assertThat(response.getGroups()).extracting(DataAssetCatalogResponse.CatalogGroup::getKey)
                .contains("客户域", "核心");
    }

    private DataAssetEntity buildEntity(UUID id) {
        return DataAssetEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name("客户宽表")
                .code("CUSTOMER_WIDE_TABLE")
                .assetType("TABLE")
                .description("desc")
                .classification("L2")
                .metadata("{}")
                .tags("[\"客户域\",\"核心\"]")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
