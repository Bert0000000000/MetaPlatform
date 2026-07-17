package com.metaplatform.ea.application.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

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
                .techStack(writeJson(request.getTechStack() != null ? request.getTechStack() : List.of()))
                .dependencies(writeJson(request.getDependencies() != null ? request.getDependencies() : List.of()))
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
        if (request.getTechStack() != null) entity.setTechStack(writeJson(request.getTechStack()));
        if (request.getDependencies() != null) entity.setDependencies(writeJson(request.getDependencies()));
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

        List<String> deps = readStringList(entity.getDependencies());
        String depIdStr = request.getDependencyId().toString();
        if (!deps.contains(depIdStr)) {
            deps.add(depIdStr);
        }
        entity.setDependencies(writeJson(deps));
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

        // Group nodes by app type for impact categorization
        Map<String, Long> byType = appMap.values().stream()
                .collect(Collectors.groupingBy(
                        e -> e.getAppType() == null ? "unknown" : e.getAppType(),
                        Collectors.counting()));

        return Map.of(
                "applicationId", root.getId(),
                "totalNodes", (long) appMap.size(),
                "totalEdges", (long) edges.size(),
                "byType", byType,
                "dependentIds", appMap.keySet().stream().map(UUID::toString).toList()
        );
    }

    private void collectDependencies(ApplicationEntity app, Map<UUID, ApplicationEntity> appMap,
                                     Set<UUID> visited, List<DependencyGraph.GraphEdge> edges) {
        if (visited.contains(app.getId())) return;
        visited.add(app.getId());

        List<String> depIds = readStringList(app.getDependencies());
        for (String depIdStr : depIds) {
            try {
                UUID depId = UUID.fromString(depIdStr);
                repository.findByIdAndDeletedAtIsNull(depId).ifPresent(dep -> {
                    appMap.putIfAbsent(depId, dep);
                    edges.add(DependencyGraph.GraphEdge.builder()
                            .from(app.getId())
                            .to(depId)
                            .dependencyType("DEPENDS_ON")
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

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败");
        }
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
                .techStack(readStringList(entity.getTechStack()))
                .dependencies(readStringList(entity.getDependencies()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
