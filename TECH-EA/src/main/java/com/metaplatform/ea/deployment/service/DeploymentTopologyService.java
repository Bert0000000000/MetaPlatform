package com.metaplatform.ea.deployment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.deployment.dto.CreateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.dto.DeploymentEdge;
import com.metaplatform.ea.deployment.dto.DeploymentNode;
import com.metaplatform.ea.deployment.dto.DeploymentTopologyResponse;
import com.metaplatform.ea.deployment.dto.UpdateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.entity.DeploymentTopologyEntity;
import com.metaplatform.ea.deployment.repository.DeploymentTopologyRepository;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeploymentTopologyService {

    private final DeploymentTopologyRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public DeploymentTopologyResponse create(CreateDeploymentTopologyRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String name = request.getName().trim();
        if (repository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, name)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名部署拓扑: " + name);
        }
        Instant now = Instant.now();
        DeploymentTopologyEntity entity = DeploymentTopologyEntity.builder()
                .tenantId(tenantId)
                .name(name)
                .environment(request.getEnvironment().trim().toLowerCase())
                .nodes(toJson(request.getNodes()))
                .edges(toJson(request.getEdges()))
                .healthStatus(StringUtils.hasText(request.getHealthStatus())
                        ? request.getHealthStatus().toLowerCase() : "healthy")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DeploymentTopologyResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<DeploymentTopologyResponse> listByEnvironment(String environment) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndEnvironmentAndDeletedAtIsNull(tenantId, environment.toLowerCase()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DeploymentTopologyResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DeploymentTopologyResponse update(UUID id, UpdateDeploymentTopologyRequest request) {
        DeploymentTopologyEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) {
            String newName = request.getName().trim();
            if (!newName.equals(entity.getName())
                    && repository.existsByTenantIdAndNameAndDeletedAtIsNull(entity.getTenantId(), newName)) {
                throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名部署拓扑: " + newName);
            }
            entity.setName(newName);
        }
        if (StringUtils.hasText(request.getEnvironment())) {
            entity.setEnvironment(request.getEnvironment().trim().toLowerCase());
        }
        if (request.getNodes() != null) entity.setNodes(toJson(request.getNodes()));
        if (request.getEdges() != null) entity.setEdges(toJson(request.getEdges()));
        if (StringUtils.hasText(request.getHealthStatus())) {
            entity.setHealthStatus(request.getHealthStatus().toLowerCase());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DeploymentTopologyEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public DeploymentTopologyEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "部署拓扑不存在"));
    }

    private String toJson(Object value) {
        if (value == null) return "[]";
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INVALID_PARAM, "拓扑数据序列化失败");
        }
    }

    private <T> List<T> fromJson(String json, TypeReference<List<T>> typeRef) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "拓扑数据反序列化失败");
        }
    }

    private DeploymentTopologyResponse toResponse(DeploymentTopologyEntity entity) {
        return DeploymentTopologyResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .environment(entity.getEnvironment())
                .nodes(fromJson(entity.getNodes(), new TypeReference<>() {}))
                .edges(fromJson(entity.getEdges(), new TypeReference<>() {}))
                .healthStatus(entity.getHealthStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
