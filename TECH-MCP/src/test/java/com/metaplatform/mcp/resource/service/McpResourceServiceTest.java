package com.metaplatform.mcp.resource.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.resource.dto.CreateResourceRequest;
import com.metaplatform.mcp.resource.dto.ResourceListItem;
import com.metaplatform.mcp.resource.dto.ResourceResponse;
import com.metaplatform.mcp.resource.dto.UpdateResourceRequest;
import com.metaplatform.mcp.resource.entity.McpResourceEntity;
import com.metaplatform.mcp.resource.repository.McpResourceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
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
class McpResourceServiceTest {

    @Mock
    private McpResourceRepository resourceRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private McpResourceService service;

    @BeforeEach
    void setUp() {
        service = new McpResourceService(resourceRepository, objectMapper);
    }

    private McpResourceEntity sampleEntity(String uri) {
        Instant now = Instant.now();
        return McpResourceEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("doc")
                .uri(uri)
                .description("desc")
                .mimeType("text/plain")
                .content("body")
                .metadata("{}")
                .relatedConceptId("concept-1")
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    void create_resource_success() {
        CreateResourceRequest request = new CreateResourceRequest();
        request.setName("doc");
        request.setUri("file://a.txt");
        request.setMimeType("text/plain");
        request.setContent("hello");

        when(resourceRepository.existsByTenantIdAndUriAndDeletedAtIsNull("tenant-default", "file://a.txt"))
                .thenReturn(false);
        when(resourceRepository.save(any(McpResourceEntity.class))).thenAnswer(inv -> {
            McpResourceEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        ResourceResponse response = service.create(request);

        assertThat(response.getUri()).isEqualTo("file://a.txt");
        assertThat(response.getMimeType()).isEqualTo("text/plain");
    }

    @Test
    void create_duplicate_uri_throws() {
        CreateResourceRequest request = new CreateResourceRequest();
        request.setName("doc");
        request.setUri("file://dup.txt");

        when(resourceRepository.existsByTenantIdAndUriAndDeletedAtIsNull("tenant-default", "file://dup.txt"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(McpException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ALREADY_EXISTS);
    }

    @Test
    void get_resource_returns_entity() {
        UUID id = UUID.randomUUID();
        McpResourceEntity entity = sampleEntity("file://a.txt");
        when(resourceRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        ResourceResponse response = service.get(id);
        assertThat(response.getUri()).isEqualTo("file://a.txt");
    }

    @Test
    void get_resource_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(resourceRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void read_content_returns_text() {
        UUID id = UUID.randomUUID();
        McpResourceEntity entity = sampleEntity("file://a.txt");
        entity.setContent("hello world");
        when(resourceRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        String content = service.readContent(id);
        assertThat(content).isEqualTo("hello world");
    }

    @Test
    void find_by_concept_returns_list() {
        McpResourceEntity e = sampleEntity("file://a.txt");
        when(resourceRepository.findByTenantIdAndRelatedConceptIdAndDeletedAtIsNull(
                "tenant-default", "concept-1")).thenReturn(List.of(e));

        List<ResourceListItem> items = service.findByConcept("concept-1");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getUri()).isEqualTo("file://a.txt");
    }

    @Test
    void update_partial_fields() {
        UUID id = UUID.randomUUID();
        McpResourceEntity entity = sampleEntity("file://a.txt");
        when(resourceRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(resourceRepository.save(any(McpResourceEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateResourceRequest request = new UpdateResourceRequest();
        request.setName("renamed");
        request.setContent("new content");

        ResourceResponse response = service.update(id, request);
        assertThat(response.getName()).isEqualTo("renamed");
        assertThat(response.getContent()).isEqualTo("new content");
    }

    @Test
    void list_with_pagination() {
        when(resourceRepository.search(eq("tenant-default"), any(), any()))
                .thenReturn(List.of(sampleEntity("file://a.txt"), sampleEntity("file://b.txt")));

        PageResponse<ResourceListItem> response = service.list(null, null, 1, 10);
        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getTotal()).isEqualTo(2);
    }

    @Test
    void delete_soft_deletes() {
        UUID id = UUID.randomUUID();
        McpResourceEntity entity = sampleEntity("file://a.txt");
        when(resourceRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(resourceRepository.save(any(McpResourceEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(id);
        assertThat(entity.getDeletedAt()).isNotNull();
    }
}