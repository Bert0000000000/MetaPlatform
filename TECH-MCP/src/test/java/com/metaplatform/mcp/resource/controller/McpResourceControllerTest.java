package com.metaplatform.mcp.resource.controller;

import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.resource.dto.ResourceListItem;
import com.metaplatform.mcp.resource.dto.ResourceResponse;
import com.metaplatform.mcp.resource.service.McpResourceService;
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

@WebMvcTest(McpResourceController.class)
class McpResourceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private McpResourceService resourceService;

    private ResourceResponse sample(UUID id) {
        return ResourceResponse.builder()
                .id(id).name("doc").uri("file://a.txt")
                .mimeType("text/plain").content("hello")
                .metadata("{}").createdAt(Instant.now()).updatedAt(Instant.now())
                .build();
    }

    @Test
    void create_returns_200() throws Exception {
        UUID id = UUID.randomUUID();
        when(resourceService.create(any())).thenReturn(sample(id));

        mockMvc.perform(post("/api/v1/mcp/resources")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"doc\",\"uri\":\"file://a.txt\",\"mimeType\":\"text/plain\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.uri").value("file://a.txt"));
    }

    @Test
    void list_returns_page() throws Exception {
        when(resourceService.list(any(), any(), any(), any()))
                .thenReturn(PageResponse.<ResourceListItem>builder()
                        .items(List.of(ResourceListItem.builder()
                                .id(UUID.randomUUID()).name("doc").uri("file://a.txt").build()))
                        .total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/resources").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].uri").value("file://a.txt"));
    }

    @Test
    void get_returns_resource() throws Exception {
        UUID id = UUID.randomUUID();
        when(resourceService.get(id)).thenReturn(sample(id));

        mockMvc.perform(get("/api/v1/mcp/resources/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void update_returns_updated() throws Exception {
        UUID id = UUID.randomUUID();
        ResourceResponse updated = sample(id);
        updated.setName("renamed");
        when(resourceService.update(eq(id), any())).thenReturn(updated);

        mockMvc.perform(put("/api/v1/mcp/resources/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("renamed"));
    }

    @Test
    void read_content_returns_text() throws Exception {
        UUID id = UUID.randomUUID();
        when(resourceService.readContent(id)).thenReturn("hello world");

        mockMvc.perform(get("/api/v1/mcp/resources/{id}/content", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("hello world"));
    }

    @Test
    void find_by_concept_returns_list() throws Exception {
        when(resourceService.findByConcept("concept-1"))
                .thenReturn(List.of(ResourceListItem.builder()
                        .id(UUID.randomUUID()).name("doc").uri("file://a.txt").build()));

        mockMvc.perform(get("/api/v1/mcp/resources/by-concept/{conceptId}", "concept-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].uri").value("file://a.txt"));
    }

    @Test
    void delete_returns_success() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/resources/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}