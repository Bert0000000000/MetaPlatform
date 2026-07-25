package com.metaplatform.ea.capabilitymap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.dto.CapabilityResponse;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.capabilitymap.dto.*;
import com.metaplatform.ea.capabilitymap.entity.CapabilityMapEntity;
import com.metaplatform.ea.capabilitymap.entity.CapabilityMapVersionEntity;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapVersionRepository;
import com.metaplatform.ea.common.TenantContext;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CapabilityMapServiceTest {

    @Mock
    private CapabilityMapRepository mapRepository;

    @Mock
    private CapabilityMapVersionRepository versionRepository;

    @Mock
    private BusinessCapabilityRepository capabilityRepository;

    @Mock
    private BusinessCapabilityService capabilityService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private CapabilityMapService capabilityMapService;

    private UUID mapId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        mapId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldReturnResponse_whenCodeIsAvailable() {
        CreateCapabilityMapRequest request = new CreateCapabilityMapRequest(
                "销售能力地图", "SALES_MAP", "描述", "销售域", null, null);

        when(mapRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MAP"))
                .thenReturn(false);
        ArgumentCaptor<CapabilityMapEntity> captor = ArgumentCaptor.forClass(CapabilityMapEntity.class);
        when(mapRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        CapabilityMapResponse response = capabilityMapService.create(request);

        assertThat(response.name()).isEqualTo("销售能力地图");
        assertThat(response.code()).isEqualTo("SALES_MAP");
        assertThat(response.businessDomain()).isEqualTo("销售域");
        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.currentVersion()).isEqualTo("v1.0");
        assertThat(response.mapId()).startsWith("MAP-SALES_MAP-");
        assertThat(captor.getValue().getRootCapabilityId()).isNull();
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateCapabilityMapRequest request = new CreateCapabilityMapRequest(
                "销售能力地图", "SALES_MAP", null, null, null, null);

        when(mapRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MAP"))
                .thenReturn(true);

        assertThatThrownBy(() -> capabilityMapService.create(request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("能力地图编码已存在");
    }

    @Test
    void create_shouldCreateRootCapability_whenRootNameProvided() {
        CreateCapabilityMapRequest request = new CreateCapabilityMapRequest(
                "销售能力地图", "SALES_MAP", null, "销售域", "销售管理", null);

        UUID rootCapId = UUID.randomUUID();
        CapabilityResponse rootCap = CapabilityResponse.builder()
                .id(rootCapId).name("销售管理").code("SALES_MAP_ROOT").build();

        when(mapRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "SALES_MAP"))
                .thenReturn(false);
        when(capabilityService.create(any())).thenReturn(rootCap);
        when(mapRepository.save(any(CapabilityMapEntity.class))).thenAnswer(i -> i.getArgument(0));

        CapabilityMapResponse response = capabilityMapService.create(request);

        assertThat(response.rootCapabilityId()).isEqualTo(rootCapId);
    }

    @Test
    void list_shouldFilterByBusinessDomain() {
        CapabilityMapEntity entity = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        when(mapRepository.findByTenantIdAndBusinessDomainAndDeletedAtIsNull("tenant-default", "销售域"))
                .thenReturn(List.of(entity));

        List<CapabilityMapResponse> result = capabilityMapService.list("销售域");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).businessDomain()).isEqualTo("销售域");
    }

    @Test
    void list_shouldReturnAll_whenNoFilter() {
        CapabilityMapEntity entity = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        when(mapRepository.findByTenantIdAndDeletedAtIsNull("tenant-default"))
                .thenReturn(List.of(entity));

        List<CapabilityMapResponse> result = capabilityMapService.list(null);

        assertThat(result).hasSize(1);
    }

    @Test
    void get_shouldThrow_whenNotFound() {
        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> capabilityMapService.get(mapId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("能力地图不存在");
    }

    @Test
    void update_shouldUpdateFields() {
        CapabilityMapEntity entity = buildMap(mapId, "SALES_MAP", "旧名称", "销售域");
        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(mapRepository.save(any(CapabilityMapEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateCapabilityMapRequest request = new UpdateCapabilityMapRequest(
                "新名称", "新描述", "供应链域", "ACTIVE");
        CapabilityMapResponse response = capabilityMapService.update(mapId, request);

        assertThat(response.name()).isEqualTo("新名称");
        assertThat(response.description()).isEqualTo("新描述");
        assertThat(response.businessDomain()).isEqualTo("供应链域");
        assertThat(response.status()).isEqualTo("ACTIVE");
    }

    @Test
    void delete_shouldSoftDelete() {
        CapabilityMapEntity entity = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(mapRepository.save(any(CapabilityMapEntity.class))).thenAnswer(i -> i.getArgument(0));

        capabilityMapService.delete(mapId);

        ArgumentCaptor<CapabilityMapEntity> captor = ArgumentCaptor.forClass(CapabilityMapEntity.class);
        verify(mapRepository).save(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void setRootCapability_shouldRejectNonTopLevelCapability() {
        CapabilityMapEntity map = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        UUID capId = UUID.randomUUID();
        BusinessCapabilityEntity cap = BusinessCapabilityEntity.builder()
                .id(capId).parentId(UUID.randomUUID()).build();

        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(map));
        when(capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(capId, "tenant-default"))
                .thenReturn(Optional.of(cap));

        SetRootCapabilityRequest request = new SetRootCapabilityRequest(capId);
        assertThatThrownBy(() -> capabilityMapService.setRootCapability(mapId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("根能力必须是顶层能力");
    }

    @Test
    void createVersion_shouldRejectDuplicateVersion() {
        CapabilityMapEntity map = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(map));
        when(versionRepository.existsByTenantIdAndMapIdAndVersion(
                "tenant-default", map.getMapId(), "v1.0"))
                .thenReturn(true);

        CreateVersionRequest request = new CreateVersionRequest("v1.0", "tester");
        assertThatThrownBy(() -> capabilityMapService.createVersion(mapId, request))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("版本号已存在");
    }

    @Test
    void publishVersion_shouldArchivePreviousPublishedAndActivateMap() {
        CapabilityMapEntity map = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        UUID versionId = UUID.randomUUID();
        CapabilityMapVersionEntity version = CapabilityMapVersionEntity.builder()
                .id(versionId).tenantId("tenant-default").mapId(map.getMapId())
                .version("v2.0").snapshot("{}").status("DRAFT").build();
        CapabilityMapVersionEntity prevPublished = CapabilityMapVersionEntity.builder()
                .id(UUID.randomUUID()).tenantId("tenant-default").mapId(map.getMapId())
                .version("v1.0").snapshot("{}").status("PUBLISHED").build();

        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(map));
        when(versionRepository.findByIdAndTenantIdAndMapId(versionId, "tenant-default", map.getMapId()))
                .thenReturn(Optional.of(version));
        when(versionRepository.findFirstByTenantIdAndMapIdAndStatusOrderByCreatedAtDesc(
                "tenant-default", map.getMapId(), "PUBLISHED"))
                .thenReturn(Optional.of(prevPublished));
        when(versionRepository.save(any(CapabilityMapVersionEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(mapRepository.save(any(CapabilityMapEntity.class))).thenAnswer(i -> i.getArgument(0));

        CapabilityMapVersionResponse response = capabilityMapService.publishVersion(mapId, versionId);

        assertThat(response.status()).isEqualTo("PUBLISHED");
        assertThat(prevPublished.getStatus()).isEqualTo("ARCHIVED");
        assertThat(map.getStatus()).isEqualTo("ACTIVE");
        assertThat(map.getCurrentVersion()).isEqualTo("v2.0");
    }

    @Test
    void rollbackVersion_shouldRejectNonPublishedVersion() {
        CapabilityMapEntity map = buildMap(mapId, "SALES_MAP", "销售能力地图", "销售域");
        UUID versionId = UUID.randomUUID();
        CapabilityMapVersionEntity version = CapabilityMapVersionEntity.builder()
                .id(versionId).tenantId("tenant-default").mapId(map.getMapId())
                .version("v2.0").snapshot("{}").status("DRAFT").build();

        when(mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(mapId, "tenant-default"))
                .thenReturn(Optional.of(map));
        when(versionRepository.findByIdAndTenantIdAndMapId(versionId, "tenant-default", map.getMapId()))
                .thenReturn(Optional.of(version));

        assertThatThrownBy(() -> capabilityMapService.rollbackVersion(mapId, versionId))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("只能回滚到已发布版本");
    }

    private CapabilityMapEntity buildMap(UUID id, String code, String name, String domain) {
        Instant now = Instant.now();
        return CapabilityMapEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .mapId("MAP-" + code)
                .name(name)
                .code(code)
                .description("desc")
                .businessDomain(domain)
                .currentVersion("v1.0")
                .status("DRAFT")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
