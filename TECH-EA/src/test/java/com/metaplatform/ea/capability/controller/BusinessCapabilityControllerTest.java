package com.metaplatform.ea.capability.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.dto.*;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TraceFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = BusinessCapabilityController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class BusinessCapabilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BusinessCapabilityService capabilityService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("销售管理");
        request.setCode("SALES_MGMT");

        CapabilityResponse response = CapabilityResponse.builder()
                .id(UUID.randomUUID())
                .code("SALES_MGMT")
                .name("销售管理")
                .level(0)
                .status("ACTIVE")
                .build();
        when(capabilityService.create(any(CreateCapabilityRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/ea/capabilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.code").value("SALES_MGMT"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateCapabilityRequest request = new CreateCapabilityRequest();
        request.setName("销售管理");

        mockMvc.perform(post("/api/v1/ea/capabilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<CapabilityResponse> page = PageResponse.<CapabilityResponse>builder()
                .items(List.of(CapabilityResponse.builder()
                        .id(UUID.randomUUID())
                        .code("SALES_MGMT")
                        .name("销售管理")
                        .level(0)
                        .status("ACTIVE")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(capabilityService.list(eq(null), eq(null), eq(null), eq(null))).thenReturn(page);

        mockMvc.perform(get("/api/v1/ea/capabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].code").value("SALES_MGMT"));
    }

    @Test
    void get_shouldReturnCapability() throws Exception {
        UUID id = UUID.randomUUID();
        CapabilityResponse response = CapabilityResponse.builder()
                .id(id)
                .code("SALES_MGMT")
                .name("销售管理")
                .level(0)
                .status("ACTIVE")
                .build();
        when(capabilityService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/ea/capabilities/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("SALES_MGMT"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        UpdateCapabilityRequest request = new UpdateCapabilityRequest();
        request.setName("销售管理（更新）");

        CapabilityResponse response = CapabilityResponse.builder()
                .id(id)
                .name("销售管理（更新）")
                .build();
        when(capabilityService.update(eq(id), any(UpdateCapabilityRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/ea/capabilities/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("销售管理（更新）"));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/ea/capabilities/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void getTree_shouldReturnTree() throws Exception {
        CapabilityTreeNode tree = CapabilityTreeNode.builder()
                .id(UUID.randomUUID())
                .code("ROOT")
                .name("根能力")
                .level(0)
                .children(List.of(CapabilityTreeNode.builder()
                        .id(UUID.randomUUID())
                        .code("CHILD")
                        .name("子能力")
                        .level(1)
                        .children(List.of())
                        .build()))
                .build();
        when(capabilityService.getTree()).thenReturn(List.of(tree));

        mockMvc.perform(get("/api/v1/ea/capabilities/tree"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("ROOT"))
                .andExpect(jsonPath("$.data[0].children[0].code").value("CHILD"));
    }

    @Test
    void getChildren_shouldReturnChildren() throws Exception {
        UUID id = UUID.randomUUID();
        when(capabilityService.getChildren(id)).thenReturn(List.of(
                CapabilityResponse.builder().id(UUID.randomUUID()).code("CHILD").name("子能力").build()));

        mockMvc.perform(get("/api/v1/ea/capabilities/{id}/children", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("CHILD"));
    }

    @Test
    void getAncestors_shouldReturnAncestors() throws Exception {
        UUID id = UUID.randomUUID();
        when(capabilityService.getAncestors(id)).thenReturn(List.of(
                CapabilityResponse.builder().id(UUID.randomUUID()).code("PARENT").name("父能力").build()));

        mockMvc.perform(get("/api/v1/ea/capabilities/{id}/ancestors", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].code").value("PARENT"));
    }

    @Test
    void move_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        MoveCapabilityRequest request = new MoveCapabilityRequest();
        request.setNewParentId(UUID.randomUUID());

        CapabilityResponse response = CapabilityResponse.builder()
                .id(id)
                .level(1)
                .build();
        when(capabilityService.move(eq(id), any(MoveCapabilityRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/ea/capabilities/{id}/move", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.level").value(1));
    }
}
