package com.metaplatform.ea.application.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.dto.DependencyGraph;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.common.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationImpactTest {

    @Mock
    private ApplicationRepository repository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ApplicationService service;

    private UUID rootAppId;
    private UUID depAppId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        rootAppId = UUID.randomUUID();
        depAppId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void dependencyGraph_shouldCollectTransitiveDependencies() {
        ApplicationEntity root = buildApp(rootAppId, "ROOT", List.of(depAppId.toString()));
        ApplicationEntity dep = buildApp(depAppId, "DEP", List.of());
        when(repository.findByIdAndDeletedAtIsNull(rootAppId)).thenReturn(Optional.of(root));
        when(repository.findByIdAndDeletedAtIsNull(depAppId)).thenReturn(Optional.of(dep));

        DependencyGraph graph = service.dependencyGraph(rootAppId);

        assertThat(graph.getRootApplicationId()).isEqualTo(rootAppId);
        assertThat(graph.getNodes()).hasSize(2);
        assertThat(graph.getEdges()).hasSize(1);
        assertThat(graph.getEdges().get(0).getDependencyType()).isEqualTo("DEPENDS_ON");
    }

    @Test
    void dependencyGraph_shouldHandleLeafNode() {
        ApplicationEntity root = buildApp(rootAppId, "LEAF", List.of());
        when(repository.findByIdAndDeletedAtIsNull(rootAppId)).thenReturn(Optional.of(root));

        DependencyGraph graph = service.dependencyGraph(rootAppId);

        assertThat(graph.getNodes()).hasSize(1);
        assertThat(graph.getEdges()).isEmpty();
    }

    @Test
    void impactAnalysis_shouldGroupByType() {
        ApplicationEntity root = buildApp(rootAppId, "ROOT", List.of(depAppId.toString()));
        root.setAppType("FRONTEND");
        ApplicationEntity dep = buildApp(depAppId, "DEP", List.of());
        dep.setAppType("BACKEND");
        when(repository.findByIdAndDeletedAtIsNull(rootAppId)).thenReturn(Optional.of(root));
        when(repository.findByIdAndDeletedAtIsNull(depAppId)).thenReturn(Optional.of(dep));

        Map<String, Object> result = service.impactAnalysis(rootAppId);

        assertThat(result.get("totalNodes")).isEqualTo(2L);
        assertThat(result.get("totalEdges")).isEqualTo(1L);
        @SuppressWarnings("unchecked")
        Map<String, Long> byType = (Map<String, Long>) result.get("byType");
        assertThat(byType).containsEntry("FRONTEND", 1L).containsEntry("BACKEND", 1L);
    }

    @Test
    void impactAnalysis_shouldReturnZeroNodes_forLeafApp() {
        ApplicationEntity root = buildApp(rootAppId, "LEAF", List.of());
        when(repository.findByIdAndDeletedAtIsNull(rootAppId)).thenReturn(Optional.of(root));

        Map<String, Object> result = service.impactAnalysis(rootAppId);

        assertThat(result.get("totalNodes")).isEqualTo(1L);
        assertThat(result.get("totalEdges")).isEqualTo(0L);
    }

    @Test
    void dependencyGraph_shouldIgnoreMalformedDependencyIds() {
        ApplicationEntity root = buildApp(rootAppId, "ROOT", List.of("not-a-uuid"));
        when(repository.findByIdAndDeletedAtIsNull(rootAppId)).thenReturn(Optional.of(root));

        DependencyGraph graph = service.dependencyGraph(rootAppId);

        assertThat(graph.getEdges()).isEmpty();
        assertThat(graph.getNodes()).hasSize(1);
    }

    private ApplicationEntity buildApp(UUID id, String code, List<String> deps) {
        return ApplicationEntity.builder()
                .id(id)
                .tenantId("tenant-default")
                .name(code + "-app")
                .code(code)
                .description("desc")
                .appType("FRONTEND")
                .status("ACTIVE")
                .techStack("[]")
                .dependencies(toJson(deps))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }
}