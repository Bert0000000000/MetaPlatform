package com.metaplatform.mcp.prompt.controller;

import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.prompt.dto.PromptTemplateResponse;
import com.metaplatform.mcp.prompt.service.PromptTemplateService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PromptTemplateController.class)
class PromptTemplateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PromptTemplateService service;

    private PromptTemplateResponse sample(UUID id) {
        return PromptTemplateResponse.builder()
                .id(id).name("greeting").template("Hello {{name}}!")
                .variables("[]").version(1).status("ACTIVE")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    @Test
    void create_returns_200() throws Exception {
        when(service.create(any())).thenReturn(sample(UUID.randomUUID()));

        mockMvc.perform(post("/api/v1/mcp/prompts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"greeting\",\"template\":\"Hello {{name}}!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("greeting"));
    }

    @Test
    void list_returns_page() throws Exception {
        when(service.list(any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.<PromptTemplateResponse>builder()
                        .items(List.of(sample(UUID.randomUUID())))
                        .total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/mcp/prompts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("greeting"));
    }

    @Test
    void get_returns_template() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenReturn(sample(id));

        mockMvc.perform(get("/api/v1/mcp/prompts/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    void render_returns_rendered_text() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.render(eq(id), any())).thenReturn(Map.of(
                "id", id, "rendered", "Hello Alice!"
        ));

        mockMvc.perform(post("/api/v1/mcp/prompts/{id}/render", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"variables\":{\"name\":\"Alice\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rendered").value("Hello Alice!"));
    }

    @Test
    void preview_returns_preview_data() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.preview(id)).thenReturn(Map.of(
                "id", id, "rendered", "Hello [name]!",
                "sampleVariables", Map.of("name", "[name]")
        ));

        mockMvc.perform(get("/api/v1/mcp/prompts/{id}/preview", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rendered").value("Hello [name]!"));
    }

    @Test
    void update_returns_updated() throws Exception {
        UUID id = UUID.randomUUID();
        PromptTemplateResponse updated = sample(id);
        updated.setTemplate("Hi {{name}}!");
        when(service.update(eq(id), any())).thenReturn(updated);

        mockMvc.perform(put("/api/v1/mcp/prompts/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"template\":\"Hi {{name}}!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.template").value("Hi {{name}}!"));
    }

    @Test
    void delete_returns_success() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/mcp/prompts/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}