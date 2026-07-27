package com.metaplatform.ea.application.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.application.dto.AddDependencyRequest;
import com.metaplatform.ea.application.dto.ApplicationResponse;
import com.metaplatform.ea.application.dto.CreateApplicationRequest;
import com.metaplatform.ea.application.dto.DependencyGraph;
import com.metaplatform.ea.application.dto.UpdateApplicationRequest;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository repository;
    private final ApplicationTechComponentService linkService;

    @Transactional
    public ApplicationResponse create(CreateApplicationRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "应用编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        ApplicationEntity entity = ApplicationEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .appType(request.getAppType())
                .status("ACTIVE")
                .techStack(request.getTechStack())
                .dependencies(request.getDependencies())
                .capabilityIds(request.getCapabilityIds())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ApplicationResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ApplicationResponse update(UUID id, UpdateApplicationRequest request) {
        ApplicationEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getAppType() != null) entity.setAppType(request.getAppType());
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toUpperCase());
        if (request.getTechStack() != null) entity.setTechStack(request.getTechStack());
        if (request.getDependencies() != null) entity.setDependencies(request.getDependencies());
        if (request.getCapabilityIds() != null) entity.setCapabilityIds(request.getCapabilityIds());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ApplicationEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    @Transactional
    public ApplicationResponse addDependency(UUID id, AddDependencyRequest request) {
        ApplicationEntity entity = findById(id);
        repository.findByIdAndDeletedAtIsNull(request.getDependencyId())
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "依赖应用不存在: " + request.getDependencyId()));

        Map<String, Object> deps = entity.getDependencies() != null
                ? new HashMap<>(entity.getDependencies())
                : new HashMap<>();
        String depIdStr = request.getDependencyId().toString();
        deps.put(depIdStr, request.getDependencyType() != null ? request.getDependencyType() : "DEPENDS_ON");
        entity.setDependencies(deps);
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public DependencyGraph dependencyGraph(UUID id) {
        ApplicationEntity root = findById(id);
        Map<UUID, ApplicationEntity> appMap = new HashMap<>();
        Set<UUID> visited = new HashSet<>();
        List<DependencyGraph.GraphEdge> edges = new ArrayList<>();

        appMap.put(root.getId(), root);
        collectDependencies(root, appMap, visited, edges);

        List<DependencyGraph.GraphNode> nodes = appMap.values().stream()
                .map(e -> DependencyGraph.GraphNode.builder()
                        .id(e.getId())
                        .name(e.getName())
                        .code(e.getCode())
                        .appType(e.getAppType())
                        .build())
                .toList();

        return DependencyGraph.builder()
                .rootApplicationId(root.getId())
                .nodes(nodes)
                .edges(edges)
                .build();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> impactAnalysis(UUID id) {
        ApplicationEntity root = findById(id);
        Map<UUID, ApplicationEntity> appMap = new HashMap<>();
        Set<UUID> visited = new HashSet<>();
        List<DependencyGraph.GraphEdge> edges = new ArrayList<>();

        appMap.put(root.getId(), root);
        collectDependencies(root, appMap, visited, edges);

        Set<UUID> affectedTechComponents = new HashSet<>();
        for (ApplicationEntity affectedApp : appMap.values()) {
            affectedTechComponents.addAll(linkService.findTechComponentIdsByApplicationId(affectedApp.getId()));
        }

        Map<String, Long> byType = appMap.values().stream()
                .collect(Collectors.groupingBy(
                        e -> e.getAppType() == null ? "unknown" : e.getAppType(),
                        Collectors.counting()));

        Map<String, Object> result = new HashMap<>();
        result.put("applicationId", root.getId());
        result.put("totalNodes", (long) appMap.size());
        result.put("totalEdges", (long) edges.size());
        result.put("byType", byType);
        result.put("dependentIds", appMap.keySet().stream().map(UUID::toString).toList());
        result.put("affectedTechComponents", affectedTechComponents.stream().map(UUID::toString).toList());
        return result;
    }

    private void collectDependencies(ApplicationEntity app, Map<UUID, ApplicationEntity> appMap,
                                     Set<UUID> visited, List<DependencyGraph.GraphEdge> edges) {
        if (visited.contains(app.getId())) return;
        visited.add(app.getId());

        Map<String, Object> depMap = app.getDependencies();
        if (depMap == null) return;
        for (String depIdStr : depMap.keySet()) {
            try {
                UUID depId = UUID.fromString(depIdStr);
                repository.findByIdAndDeletedAtIsNull(depId).ifPresent(dep -> {
                    appMap.putIfAbsent(depId, dep);
                    Object depType = depMap.get(depIdStr);
                    edges.add(DependencyGraph.GraphEdge.builder()
                            .from(app.getId())
                            .to(depId)
                            .dependencyType(depType != null ? depType.toString() : "DEPENDS_ON")
                            .build());
                    collectDependencies(dep, appMap, visited, edges);
                });
            } catch (IllegalArgumentException ignored) {
            }
        }
    }

    private ApplicationEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "应用不存在"));
    }

    private ApplicationResponse toResponse(ApplicationEntity entity) {
        return ApplicationResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .appType(entity.getAppType())
                .status(entity.getStatus())
                .techStack(entity.getTechStack())
                .dependencies(entity.getDependencies())
                .capabilityIds(entity.getCapabilityIds())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}