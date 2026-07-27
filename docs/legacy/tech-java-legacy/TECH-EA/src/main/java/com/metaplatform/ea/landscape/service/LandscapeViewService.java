package com.metaplatform.ea.landscape.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.application.repository.ApplicationTechComponentRepository;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.landscape.dto.LandscapeView;
import com.metaplatform.ea.techarchitecture.entity.InfrastructureEntity;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
import com.metaplatform.ea.techstack.entity.TechnologyStackEntity;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 架构分层视图服务。
 *
 * <p>聚合 BusinessCapability → Application → TechStack/TechComponent → Infrastructure 四层节点，
 * 通过 capabilityIds、application_id、关联表构造层间关联边，用于 landscape 可视化与影响分析。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LandscapeViewService {

    private static final String LAYER_CAPABILITY = "BUSINESS_CAPABILITY";
    private static final String LAYER_APPLICATION = "APPLICATION";
    private static final String LAYER_TECH_STACK = "TECH_STACK";
    private static final String LAYER_INFRASTRUCTURE = "INFRASTRUCTURE";

    private final BusinessCapabilityRepository capabilityRepository;
    private final ApplicationRepository applicationRepository;
    private final TechnologyStackRepository techStackRepository;
    private final TechnologyComponentRepository techComponentRepository;
    private final InfrastructureRepository infrastructureRepository;
    private final ApplicationTechComponentRepository appTechLinkRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public LandscapeView buildLandscape() {
        String tenantId = TenantContext.getOrDefault();
        List<LandscapeView.Layer> layers = new ArrayList<>();
        List<LandscapeView.LayerEdge> edges = new ArrayList<>();

        // Layer 1: BusinessCapability
        List<BusinessCapabilityEntity> capabilities =
                capabilityRepository.findByTenantIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(tenantId);
        List<LandscapeView.LayerNode> capNodes = capabilities.stream()
                .map(c -> LandscapeView.LayerNode.builder()
                        .id(c.getId())
                        .code(c.getCode())
                        .name(c.getName())
                        .type(c.getStatus())
                        .status(c.getStatus())
                        .parentId(c.getParentId())
                        .level(c.getLevel())
                        .build())
                .toList();
        layers.add(LandscapeView.Layer.builder()
                .name(LAYER_CAPABILITY)
                .nodeCount(capNodes.size())
                .nodes(capNodes)
                .build());

        // Layer 2: Application
        List<ApplicationEntity> applications = applicationRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        List<LandscapeView.LayerNode> appNodes = applications.stream()
                .map(a -> LandscapeView.LayerNode.builder()
                        .id(a.getId())
                        .code(a.getCode())
                        .name(a.getName())
                        .type(a.getAppType())
                        .status(a.getStatus())
                        .build())
                .toList();
        layers.add(LandscapeView.Layer.builder()
                .name(LAYER_APPLICATION)
                .nodeCount(appNodes.size())
                .nodes(appNodes)
                .build());

        // Layer 3: TechStack（聚合 TechnologyStack 画像 + TechnologyComponent 组件库）
        List<TechnologyStackEntity> stacks = techStackRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        List<LandscapeView.LayerNode> stackNodes = stacks.stream()
                .map(s -> LandscapeView.LayerNode.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .status(s.getStatus())
                        .build())
                .toList();
        List<TechnologyComponentEntity> components =
                techComponentRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        List<LandscapeView.LayerNode> componentNodes = components.stream()
                .map(c -> LandscapeView.LayerNode.builder()
                        .id(c.getId())
                        .code(c.getType())
                        .name(c.getName())
                        .type(c.getType())
                        .status(c.getStatus())
                        .build())
                .toList();
        List<LandscapeView.LayerNode> techNodes = new ArrayList<>(stackNodes);
        techNodes.addAll(componentNodes);
        layers.add(LandscapeView.Layer.builder()
                .name(LAYER_TECH_STACK)
                .nodeCount(techNodes.size())
                .nodes(techNodes)
                .build());

        // Layer 4: Infrastructure
        List<InfrastructureEntity> infras = infrastructureRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        List<LandscapeView.LayerNode> infraNodes = infras.stream()
                .map(i -> LandscapeView.LayerNode.builder()
                        .id(i.getId())
                        .code(i.getCode())
                        .name(i.getName())
                        .type(i.getEnvironment())
                        .build())
                .toList();
        layers.add(LandscapeView.Layer.builder()
                .name(LAYER_INFRASTRUCTURE)
                .nodeCount(infraNodes.size())
                .nodes(infraNodes)
                .build());

        // Edges: Capability → Application（基于 ApplicationEntity.capability_ids JSONB）
        Map<String, BusinessCapabilityEntity> capByCodeOrId = new HashMap<>();
        for (BusinessCapabilityEntity cap : capabilities) {
            capByCodeOrId.put(cap.getId().toString(), cap);
        }
        for (ApplicationEntity app : applications) {
            List<String> capIds = app.getCapabilityIds() == null
                    ? List.of() : new ArrayList<>(app.getCapabilityIds().keySet());
            for (String capId : capIds) {
                if (capByCodeOrId.containsKey(capId)) {
                    edges.add(LandscapeView.LayerEdge.builder()
                            .fromLayer(LAYER_CAPABILITY)
                            .toLayer(LAYER_APPLICATION)
                            .fromId(UUID.fromString(capId))
                            .toId(app.getId())
                            .relationshipType("OWNS")
                            .build());
                }
            }
        }

        // Edges: Application → TechStack（基于 TechnologyStackEntity.application_id）
        Map<String, ApplicationEntity> appById = new HashMap<>();
        for (ApplicationEntity app : applications) {
            appById.put(app.getId().toString(), app);
        }
        for (TechnologyStackEntity stack : stacks) {
            if (stack.getApplicationId() != null) {
                try {
                    UUID appId = UUID.fromString(stack.getApplicationId());
                    if (appById.containsKey(stack.getApplicationId())) {
                        edges.add(LandscapeView.LayerEdge.builder()
                                .fromLayer(LAYER_APPLICATION)
                                .toLayer(LAYER_TECH_STACK)
                                .fromId(appId)
                                .toId(stack.getId())
                                .relationshipType("USES")
                                .build());
                    }
                } catch (IllegalArgumentException ignored) {
                }
            }
        }

        // Edges: Application → TechnologyComponent（基于关联表）
        for (ApplicationEntity app : applications) {
            appTechLinkRepository.findByTenantIdAndApplicationIdAndDeletedAtIsNull(tenantId, app.getId())
                    .forEach(link -> edges.add(LandscapeView.LayerEdge.builder()
                            .fromLayer(LAYER_APPLICATION)
                            .toLayer(LAYER_TECH_STACK)
                            .fromId(app.getId())
                            .toId(link.getTechComponentId())
                            .relationshipType(link.getRelationshipType())
                            .build()));
        }

        return LandscapeView.builder()
                .tenantId(tenantId)
                .layers(layers)
                .edges(edges)
                .generatedAt(Instant.now())
                .build();
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse JSON list: {}", json, e);
            return List.of();
        }
    }
}
