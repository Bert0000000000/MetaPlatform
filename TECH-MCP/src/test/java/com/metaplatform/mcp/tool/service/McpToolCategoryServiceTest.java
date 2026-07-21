package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.dto.McpToolCategoryResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.entity.McpToolCategoryEntity;
import com.metaplatform.mcp.tool.repository.McpToolCategoryRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class McpToolCategoryServiceTest {

    @Mock
    private McpToolCategoryRepository categoryRepository;

    private McpToolCategoryService categoryService;

    @BeforeEach
    void setUp() {
        categoryService = new McpToolCategoryService(categoryRepository);
    }

    @Test
    void create_category_success() {
        CreateMcpToolCategoryRequest request = new CreateMcpToolCategoryRequest();
        request.setName("数据查询");
        request.setCode("data_query");

        when(categoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "data_query"))
                .thenReturn(false);
        when(categoryRepository.save(any())).thenAnswer(inv -> {
            McpToolCategoryEntity e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        McpToolCategoryResponse response = categoryService.create(request);

        assertThat(response.getCode()).isEqualTo("data_query");
        assertThat(response.getName()).isEqualTo("数据查询");
    }

    @Test
    void create_duplicate_code_throws() {
        CreateMcpToolCategoryRequest request = new CreateMcpToolCategoryRequest();
        request.setName("数据查询");
        request.setCode("data_query");

        when(categoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "data_query"))
                .thenReturn(true);

        assertThatThrownBy(() -> categoryService.create(request))
                .isInstanceOf(McpException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ALREADY_EXISTS);
    }

    @Test
    void list_categories_returns_sorted() {
        when(categoryRepository.findByTenantIdAndDeletedAtIsNullOrderBySortOrderAsc("tenant-default"))
                .thenReturn(List.of(
                        McpToolCategoryEntity.builder().id(UUID.randomUUID()).name("A").code("a").sortOrder(0).createdAt(Instant.now()).updatedAt(Instant.now()).build(),
                        McpToolCategoryEntity.builder().id(UUID.randomUUID()).name("B").code("b").sortOrder(1).createdAt(Instant.now()).updatedAt(Instant.now()).build()
                ));

        List<McpToolCategoryResponse> list = categoryService.list();

        assertThat(list).hasSize(2);
        assertThat(list.get(0).getCode()).isEqualTo("a");
    }

    @Test
    void update_category_success() {
        UUID id = UUID.randomUUID();
        McpToolCategoryEntity entity = McpToolCategoryEntity.builder()
                .id(id).tenantId("tenant-default").name("旧名称").code("old_code")
                .sortOrder(0).createdAt(Instant.now()).updatedAt(Instant.now()).build();

        when(categoryRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateMcpToolCategoryRequest request = new UpdateMcpToolCategoryRequest();
        request.setName("新名称");

        McpToolCategoryResponse response = categoryService.update(id, request);

        assertThat(response.getName()).isEqualTo("新名称");
    }

    @Test
    void delete_category_soft_deletes() {
        UUID id = UUID.randomUUID();
        McpToolCategoryEntity entity = McpToolCategoryEntity.builder()
                .id(id).tenantId("tenant-default").name("A").code("a")
                .sortOrder(0).createdAt(Instant.now()).updatedAt(Instant.now()).build();

        when(categoryRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, "tenant-default"))
                .thenReturn(Optional.of(entity));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        categoryService.delete(id);

        assertThat(entity.getDeletedAt()).isNotNull();
    }
}
