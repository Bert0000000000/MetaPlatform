package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.tool.dto.McpToolCategoryResponse;
import com.metaplatform.mcp.tool.service.McpToolCategoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(McpToolCategoryController.class)
class McpToolCategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpToolCategoryService categoryService;

    @Test
    void create_category_returns_200() throws Exception {
        when(categoryService.create(any())).thenReturn(sample());

        mockMvc.perform(post("/api/v1/mcp/tool-categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"数据查询\",\"code\":\"data_query\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("data_query"));
    }

    @Test
    void list_categories_returns_list() throws Exception {
        when(categoryService.list()).thenReturn(List.of(sample()));

        mockMvc.perform(get("/api/v1/mcp/tool-categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("数据查询"));
    }

    @Test
    void update_category_returns_updated() throws Exception {
        UUID id = UUID.randomUUID();
        McpToolCategoryResponse response = sample();
        response.setId(id);
        when(categoryService.update(eq(id), any())).thenReturn(response);

        mockMvc.perform(put("/api/v1/mcp/tool-categories/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"更新\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void delete_category_returns_success() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/tool-categories/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    private McpToolCategoryResponse sample() {
        return McpToolCategoryResponse.builder()
                .id(UUID.randomUUID())
                .name("数据查询")
                .code("data_query")
                .sortOrder(0)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
