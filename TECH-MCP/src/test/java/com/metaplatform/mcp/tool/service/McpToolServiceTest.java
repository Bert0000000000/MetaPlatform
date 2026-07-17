package com.metaplatform.mcp.tool.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
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

    private final ObjectMapper objectMapper = new ObjectMapper();
    private McpToolService mcpToolService;

    @BeforeEach
    void setUp() {
        mcpToolService = new McpToolService(mcpToolRepository, objectMapper);
    }

    private McpToolEntity toolEntity(String code, String toolType, boolean enabled) {
        Instant now = Instant.now();
        return McpToolEntity.builder()
                .id(UUID.randomUUID())
                .tenantId("tenant-default")
                .name("tool-" + code)
                .code(code)
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
        request.setToolType("http");
        request.setEndpoint("http://example.com");
        request.setEnabled(true);

        when(mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "my_tool"))
                .thenReturn(false);
        when(mcpToolRepository.save(any(McpToolEntity.class)))
                .thenAnswer(inv -> {
                    McpToolEntity e = inv.getArgument(0);
                    e.setId(UUID.randomUUID());
                    return e;
                });

        McpToolResponse response = mcpToolService.create(request);

        assertThat(response.getCode()).isEqualTo("my_tool");
        assertThat(response.getToolType()).isEqualTo("HTTP");
        assertThat(response.getEnabled()).isTrue();
        assertThat(response.getId()).isNotNull();
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
        when(mcpToolRepository.search(any(), any(), any(), any(), any()))
                .thenReturn(List.of(toolEntity("t1", "HTTP", true), toolEntity("t2", "BEAN", true)));

        PageResponse<McpToolListItem> page = mcpToolService.list(
                null, "http", true, null, 1, 10);

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
}
