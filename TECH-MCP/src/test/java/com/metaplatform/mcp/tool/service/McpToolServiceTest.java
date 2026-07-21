package com.metaplatform.mcp.tool.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionCompareResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.entity.McpToolVersionEntity;
import com.metaplatform.mcp.tool.repository.McpToolCategoryRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import com.metaplatform.mcp.tool.repository.McpToolVersionRepository;
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
class McpToolServiceTest {

    @Mock
    private McpToolRepository mcpToolRepository;
    @Mock
    private McpToolVersionRepository mcpToolVersionRepository;
    @Mock
    private McpToolCategoryRepository mcpToolCategoryRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private McpToolService mcpToolService;

    @BeforeEach
    void setUp() {
        mcpToolService = new McpToolService(mcpToolRepository, mcpToolVersionRepository, mcpToolCategoryRepository, objectMapper);
    }

    private McpToolEntity toolEntity(String code, String toolType, boolean enabled) {
        Instant now = Instant.now();
        return McpToolEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("tool-" + code)
                .code(code)
                .category("default")
                .version("1.0.0")
                .description("desc")
                .inputSchema("{}")
                .outputSchema("{}")
                .toolType(toolType)
                .endpoint("http://example.com")
                .beanClass(null)
                .enabled(enabled)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    @Test
    void create_tool_success() {
        CreateMcpToolRequest request = new CreateMcpToolRequest();
        request.setName("My Tool");
        request.setCode("my_tool");
        request.setCategory("default");
        request.setToolType("http");
        request.setEndpoint("http://example.com");
        request.setEnabled(true);

        when(mcpToolCategoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "default"))
                .thenReturn(true);
        when(mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "my_tool"))
                .thenReturn(false);
        when(mcpToolRepository.save(any(McpToolEntity.class)))
                .thenAnswer(inv -> {
                    McpToolEntity e = inv.getArgument(0);
                    e.setId(UUID.randomUUID());
                    return e;
                });
        when(mcpToolVersionRepository.save(any(McpToolVersionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpToolResponse response = mcpToolService.create(request);

        assertThat(response.getCode()).isEqualTo("my_tool");
        assertThat(response.getToolType()).isEqualTo("HTTP");
        assertThat(response.getEnabled()).isTrue();
        assertThat(response.getId()).isNotNull();
        verify(mcpToolVersionRepository).save(any(McpToolVersionEntity.class));
    }

    @Test
    void create_tool_duplicate_code_throws() {
        CreateMcpToolRequest request = new CreateMcpToolRequest();
        request.setName("My Tool");
        request.setCode("dup_tool");
        request.setToolType("HTTP");

        when(mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "dup_tool"))
                .thenReturn(true);

        assertThatThrownBy(() -> mcpToolService.create(request))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ALREADY_EXISTS);
    }

    @Test
    void create_tool_unknown_category_throws() {
        CreateMcpToolRequest request = new CreateMcpToolRequest();
        request.setName("My Tool");
        request.setCode("cat_tool");
        request.setCategory("missing");
        request.setToolType("HTTP");

        when(mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "cat_tool"))
                .thenReturn(false);
        when(mcpToolCategoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "missing"))
                .thenReturn(false);

        assertThatThrownBy(() -> mcpToolService.create(request))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOOL_CATEGORY_NOT_FOUND);
    }

    @Test
    void get_tool_not_found_throws() {
        UUID id = UUID.randomUUID();
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mcpToolService.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOOL_NOT_FOUND);
    }

    @Test
    void tenant_isolation_when_tenant_mismatch_throws() {
        UUID id = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        entity.setTenantId("other-tenant");
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> mcpToolService.get(id))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOOL_NOT_FOUND);
    }

    @Test
    void update_tool_partial() {
        UUID id = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMcpToolRequest request = new UpdateMcpToolRequest();
        request.setName("Updated Name");
        request.setToolType("bean");

        McpToolResponse response = mcpToolService.update(id, request);

        assertThat(response.getName()).isEqualTo("Updated Name");
        assertThat(response.getToolType()).isEqualTo("BEAN");
    }

    @Test
    void update_tool_schema_change_creates_version() {
        UUID id = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mcpToolVersionRepository.save(any(McpToolVersionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMcpToolRequest request = new UpdateMcpToolRequest();
        request.setInputSchema("{\"type\":\"object\"}");

        McpToolResponse response = mcpToolService.update(id, request);

        assertThat(response.getVersion()).isEqualTo("1.0.1");
        verify(mcpToolVersionRepository).save(any(McpToolVersionEntity.class));
    }

    @Test
    void enable_and_disable_tool() {
        UUID id = UUID.randomUUID();

        McpToolEntity disabled = toolEntity("t1", "HTTP", false);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(disabled));
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        McpToolResponse enabled = mcpToolService.enable(id);
        assertThat(enabled.getEnabled()).isTrue();

        McpToolEntity enabledEntity = toolEntity("t1", "HTTP", true);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(enabledEntity));
        McpToolResponse disabledResp = mcpToolService.disable(id);
        assertThat(disabledResp.getEnabled()).isFalse();
    }

    @Test
    void list_with_filters_returns_paginated() {
        when(mcpToolRepository.search(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(toolEntity("t1", "HTTP", true), toolEntity("t2", "BEAN", true)));

        PageResponse<McpToolListItem> page = mcpToolService.list(
                null, "http", true, null, "default", 1, 10);

        assertThat(page.getItems()).hasSize(2);
        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getTotal()).isEqualTo(2);
    }

    @Test
    void delete_tool_soft_deletes() {
        UUID id = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(id)).thenReturn(Optional.of(entity));
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        mcpToolService.delete(id);

        assertThat(entity.getDeletedAt()).isNotNull();
        verify(mcpToolRepository).save(entity);
    }

    @Test
    void list_versions_returns_sorted() {
        UUID toolId = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        entity.setId(toolId);
        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(entity));
        when(mcpToolVersionRepository.findByToolIdAndTenantIdOrderByCreatedAtDesc(toolId, "tenant-default"))
                .thenReturn(List.of(
                        McpToolVersionEntity.builder().id(UUID.randomUUID()).toolId(toolId).version("1.0.1").isCurrent(true).createdAt(Instant.now()).build(),
                        McpToolVersionEntity.builder().id(UUID.randomUUID()).toolId(toolId).version("1.0.0").isCurrent(false).createdAt(Instant.now()).build()
                ));

        List<McpToolVersionResponse> versions = mcpToolService.listVersions(toolId);

        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).getVersion()).isEqualTo("1.0.1");
    }

    @Test
    void rollback_restores_version() {
        UUID toolId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        entity.setId(toolId);
        entity.setInputSchema("{\"new\":true}");
        McpToolVersionEntity version = McpToolVersionEntity.builder()
                .id(versionId)
                .toolId(toolId)
                .tenantId("tenant-default")
                .version("1.0.0")
                .schema("{\"old\":true}")
                .description("old desc")
                .isCurrent(false)
                .createdAt(Instant.now())
                .build();

        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(entity));
        when(mcpToolVersionRepository.findByIdAndTenantId(versionId, "tenant-default")).thenReturn(Optional.of(version));
        when(mcpToolVersionRepository.save(any(McpToolVersionEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mcpToolRepository.save(any(McpToolEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        McpToolVersionResponse response = mcpToolService.rollback(toolId, versionId);

        assertThat(response.getIsCurrent()).isTrue();
        assertThat(entity.getVersion()).isEqualTo("1.0.0");
        assertThat(entity.getInputSchema()).isEqualTo("{\"old\":true}");
    }

    @Test
    void compare_versions_returns_differences() {
        UUID toolId = UUID.randomUUID();
        UUID leftId = UUID.randomUUID();
        UUID rightId = UUID.randomUUID();
        McpToolEntity entity = toolEntity("t1", "HTTP", true);
        entity.setId(toolId);
        McpToolVersionEntity left = McpToolVersionEntity.builder()
                .id(leftId).toolId(toolId).tenantId("tenant-default").version("1.0.0")
                .schema("{\"a\":1}").description("d1").createdAt(Instant.now()).build();
        McpToolVersionEntity right = McpToolVersionEntity.builder()
                .id(rightId).toolId(toolId).tenantId("tenant-default").version("1.0.1")
                .schema("{\"a\":2}").description("d2").createdAt(Instant.now()).build();

        when(mcpToolRepository.findByIdAndDeletedAtIsNull(toolId)).thenReturn(Optional.of(entity));
        when(mcpToolVersionRepository.findByIdAndTenantId(leftId, "tenant-default")).thenReturn(Optional.of(left));
        when(mcpToolVersionRepository.findByIdAndTenantId(rightId, "tenant-default")).thenReturn(Optional.of(right));

        McpToolVersionCompareResponse compare = mcpToolService.compareVersions(toolId, leftId, rightId);

        assertThat(compare.getDifferences()).contains("description", "schema");
    }
}
