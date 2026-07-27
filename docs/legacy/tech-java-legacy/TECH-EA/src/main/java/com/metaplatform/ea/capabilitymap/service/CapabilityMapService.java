package com.metaplatform.ea.capabilitymap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.metaplatform.ea.capability.dto.CreateCapabilityRequest;
import com.metaplatform.ea.capability.dto.CapabilityResponse;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.capabilitymap.dto.*;
import com.metaplatform.ea.capabilitymap.entity.CapabilityMapEntity;
import com.metaplatform.ea.capabilitymap.entity.CapabilityMapVersionEntity;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapVersionRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CapabilityMapService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_ARCHIVED = "ARCHIVED";
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final CapabilityMapRepository mapRepository;
    private final CapabilityMapVersionRepository versionRepository;
    private final BusinessCapabilityRepository capabilityRepository;
    private final BusinessCapabilityService capabilityService;
    private final ObjectMapper objectMapper;

    // ---------- 能力地图 CRUD ----------

    @Transactional
    public CapabilityMapResponse create(CreateCapabilityMapRequest request) {
        String tenantId = TenantContext.getOrDefault();

        if (mapRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.code())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "能力地图编码已存在: " + request.code());
        }

        UUID rootCapabilityId = null;
        if (StringUtils.hasText(request.rootCapabilityName())) {
            CreateCapabilityRequest capReq = new CreateCapabilityRequest();
            capReq.setName(request.rootCapabilityName());
            capReq.setCode(request.code() + "_ROOT");
            capReq.setDescription("能力地图 " + request.name() + " 的根能力");
            CapabilityResponse rootCap = capabilityService.create(capReq);
            rootCapabilityId = rootCap.getId();
        }

        String mapId = generateMapId(request.code());
        Instant now = Instant.now();
        String version = StringUtils.hasText(request.version()) ? request.version() : "v1.0";

        CapabilityMapEntity entity = CapabilityMapEntity.builder()
                .tenantId(tenantId)
                .mapId(mapId)
                .name(request.name())
                .code(request.code())
                .description(request.description())
                .businessDomain(request.businessDomain())
                .rootCapabilityId(rootCapabilityId)
                .currentVersion(version)
                .status(STATUS_DRAFT)
                .createdAt(now)
                .updatedAt(now)
                .build();
        CapabilityMapEntity saved = mapRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<CapabilityMapResponse> list(String businessDomain) {
        String tenantId = TenantContext.getOrDefault();
        List<CapabilityMapEntity> entities = StringUtils.hasText(businessDomain)
                ? mapRepository.findByTenantIdAndBusinessDomainAndDeletedAtIsNull(tenantId, businessDomain)
                : mapRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        return entities.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CapabilityMapResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public CapabilityMapResponse update(UUID id, UpdateCapabilityMapRequest request) {
        CapabilityMapEntity entity = findById(id);
        if (request.name() != null) {
            entity.setName(request.name());
        }
        if (request.description() != null) {
            entity.setDescription(request.description());
        }
        if (request.businessDomain() != null) {
            entity.setBusinessDomain(request.businessDomain());
        }
        if (request.status() != null) {
            validateMapStatus(request.status());
            entity.setStatus(request.status());
        }
        entity.setUpdatedAt(Instant.now());
        CapabilityMapEntity saved = mapRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        CapabilityMapEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        mapRepository.save(entity);
    }

    // ---------- 根能力管理 ----------

    @Transactional
    public CapabilityMapResponse setRootCapability(UUID mapId, SetRootCapabilityRequest request) {
        CapabilityMapEntity entity = findById(mapId);
        UUID rootId = request.rootCapabilityId();
        BusinessCapabilityEntity cap = capabilityRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(rootId, TenantContext.getOrDefault())
                .orElseThrow(() -> new EaException(ErrorCode.CAPABILITY_NOT_FOUND, "根能力不存在: " + rootId));
        if (cap.getParentId() != null) {
            throw new EaException(ErrorCode.BUSINESS_RULE_VIOLATION, "根能力必须是顶层能力（无父节点）");
        }
        entity.setRootCapabilityId(rootId);
        entity.setUpdatedAt(Instant.now());
        CapabilityMapEntity saved = mapRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CapabilityResponse getRootCapability(UUID mapId) {
        CapabilityMapEntity entity = findById(mapId);
        if (entity.getRootCapabilityId() == null) {
            return null;
        }
        return capabilityService.get(entity.getRootCapabilityId());
    }

    // ---------- 版本管理 ----------

    @Transactional(readOnly = true)
    public List<CapabilityMapVersionResponse> listVersions(UUID mapId) {
        CapabilityMapEntity map = findById(mapId);
        return versionRepository
                .findByTenantIdAndMapIdOrderByCreatedAtDesc(map.getTenantId(), map.getMapId())
                .stream().map(this::toVersionResponse).toList();
    }

    @Transactional
    public CapabilityMapVersionResponse createVersion(UUID mapId, CreateVersionRequest request) {
        CapabilityMapEntity map = findById(mapId);
        String tenantId = map.getTenantId();
        String version = request.version();

        if (versionRepository.existsByTenantIdAndMapIdAndVersion(tenantId, map.getMapId(), version)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "版本号已存在: " + version);
        }

        String snapshot = buildSnapshot(map);
        Instant now = Instant.now();
        CapabilityMapVersionEntity versionEntity = CapabilityMapVersionEntity.builder()
                .tenantId(tenantId)
                .mapId(map.getMapId())
                .version(version)
                .snapshot(snapshot)
                .status(STATUS_DRAFT)
                .createdBy(request.createdBy())
                .createdAt(now)
                .build();
        CapabilityMapVersionEntity saved = versionRepository.save(versionEntity);
        return toVersionResponse(saved);
    }

    @Transactional
    public CapabilityMapVersionResponse publishVersion(UUID mapId, UUID versionId) {
        CapabilityMapEntity map = findById(mapId);
        CapabilityMapVersionEntity version = findVersionById(map, versionId);

        versionRepository.findFirstByTenantIdAndMapIdAndStatusOrderByCreatedAtDesc(
                        map.getTenantId(), map.getMapId(), STATUS_PUBLISHED)
                .ifPresent(prev -> {
                    prev.setStatus(STATUS_ARCHIVED);
                    versionRepository.save(prev);
                });

        version.setStatus(STATUS_PUBLISHED);
        CapabilityMapVersionEntity saved = versionRepository.save(version);

        map.setCurrentVersion(version.getVersion());
        map.setStatus(STATUS_ACTIVE);
        map.setUpdatedAt(Instant.now());
        mapRepository.save(map);

        return toVersionResponse(saved);
    }

    @Transactional
    public CapabilityMapVersionResponse rollbackVersion(UUID mapId, UUID versionId) {
        CapabilityMapEntity map = findById(mapId);
        CapabilityMapVersionEntity target = findVersionById(map, versionId);

        if (!STATUS_PUBLISHED.equals(target.getStatus())) {
            throw new EaException(ErrorCode.BUSINESS_RULE_VIOLATION, "只能回滚到已发布版本");
        }

        map.setCurrentVersion(target.getVersion());
        map.setUpdatedAt(Instant.now());
        mapRepository.save(map);

        return toVersionResponse(target);
    }

    // ---------- 内部方法 ----------

    public CapabilityMapEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mapRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.CAPABILITY_MAP_NOT_FOUND, "能力地图不存在"));
    }

    private CapabilityMapVersionEntity findVersionById(CapabilityMapEntity map, UUID versionId) {
        return versionRepository
                .findByIdAndTenantIdAndMapId(versionId, map.getTenantId(), map.getMapId())
                .orElseThrow(() -> new EaException(ErrorCode.MAP_VERSION_NOT_FOUND, "能力地图版本不存在"));
    }

    private String generateMapId(String code) {
        return "MAP-" + code + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String buildSnapshot(CapabilityMapEntity map) {
        try {
            ObjectMapper writer = objectMapper.copy()
                    .configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("mapId", map.getMapId());
            snapshot.put("name", map.getName());
            snapshot.put("code", map.getCode());
            snapshot.put("description", map.getDescription());
            snapshot.put("businessDomain", map.getBusinessDomain());
            snapshot.put("rootCapabilityId", map.getRootCapabilityId());
            snapshot.put("currentVersion", map.getCurrentVersion());
            snapshot.put("status", map.getStatus());
            snapshot.put("snapshotAt", Instant.now().toString());
            return writer.writeValueAsString(snapshot);
        } catch (Exception e) {
            log.warn("Failed to build snapshot for map {}", map.getMapId(), e);
            return "{}";
        }
    }

    private void validateMapStatus(String status) {
        if (!STATUS_DRAFT.equals(status) && !STATUS_ACTIVE.equals(status) && !STATUS_ARCHIVED.equals(status)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "status 必须为 DRAFT / ACTIVE / ARCHIVED");
        }
    }

    private CapabilityMapResponse toResponse(CapabilityMapEntity entity) {
        return CapabilityMapResponse.builder()
                .id(entity.getId())
                .mapId(entity.getMapId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .businessDomain(entity.getBusinessDomain())
                .rootCapabilityId(entity.getRootCapabilityId())
                .currentVersion(entity.getCurrentVersion())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private CapabilityMapVersionResponse toVersionResponse(CapabilityMapVersionEntity entity) {
        return CapabilityMapVersionResponse.builder()
                .id(entity.getId())
                .mapId(entity.getMapId())
                .version(entity.getVersion())
                .snapshot(entity.getSnapshot())
                .status(entity.getStatus())
                .createdBy(entity.getCreatedBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
