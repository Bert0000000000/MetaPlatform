package com.metaplatform.iam.position.controller;

import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.position.dto.PositionResponse;
import com.metaplatform.iam.position.service.PositionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PositionController.class)
class PositionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PositionService positionService;

    private PositionResponse sample(String id) {
        return PositionResponse.builder()
                .id(id).code("mgr").name("manager").level(1).version(1).build();
    }

    @Test
    void create_returns_200() throws Exception {
        when(positionService.create(any())).thenReturn(sample(UUID.randomUUID().toString()));

        mockMvc.perform(post("/api/v1/iam/positions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"manager\",\"code\":\"mgr\",\"level\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("mgr"));
    }

    @Test
    void list_returns_page() throws Exception {
        when(positionService.list(any(), any(), any(), any()))
                .thenReturn(PageResponse.<PositionResponse>builder()
                        .items(List.of(sample(UUID.randomUUID().toString())))
                        .total(1).page(1).size(20).totalPages(1).build());

        mockMvc.perform(get("/api/v1/iam/positions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].code").value("mgr"));
    }

    @Test
    void get_returns_position() throws Exception {
        String id = UUID.randomUUID().toString();
        when(positionService.get(id)).thenReturn(sample(id));

        mockMvc.perform(get("/api/v1/iam/positions/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id));
    }

    @Test
    void update_returns_updated() throws Exception {
        String id = UUID.randomUUID().toString();
        PositionResponse updated = sample(id);
        updated.setName("renamed");
        when(positionService.update(any(), any())).thenReturn(updated);

        mockMvc.perform(put("/api/v1/iam/positions/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("renamed"));
    }

    @Test
    void delete_returns_success() throws Exception {
        mockMvc.perform(delete("/api/v1/iam/positions/{id}", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}