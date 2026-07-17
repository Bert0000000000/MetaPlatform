package com.metaplatform.ea.mapping.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TraceFilter;
import com.metaplatform.ea.mapping.dto.CreateMappingRequest;
import com.metaplatform.ea.mapping.dto.MapConceptRequest;
import com.metaplatform.ea.mapping.dto.MappingResponse;
import com.metaplatform.ea.mapping.dto.UpdateMappingRequest;
import com.metaplatform.ea.mapping.service.CapabilityConceptMappingService;
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

@WebMvcTest(controllers = CapabilityConceptMappingController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class CapabilityConceptMappingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CapabilityConceptMappingService mappingService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(UUID.randomUUID());
        request.setConceptId("concept-001");
        request.setMappingType("DIRECT");

        MappingResponse response = MappingResponse.builder()
                .id(UUID.randomUUID())
                .conceptId("concept-001")
                .mappingType("DIRECT")
                .build();
        when(mappingService.create(any(CreateMappingRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/ea/capability-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conceptId").value("concept-001"))
                .andExpect(jsonPath("$.data.mappingType").value("DIRECT"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateMappingRequest request = new CreateMappingRequest();
        request.setCapabilityId(UUID.randomUUID());

        mockMvc.perform(post("/api/v1/ea/capability-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnAllMappings() throws Exception {
        when(mappingService.list()).thenReturn(List.of(
                MappingResponse.builder()
                        .id(UUID.randomUUID())
                        .conceptId("concept-001")
                        .mappingType("DIRECT")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()));

        mockMvc.perform(get("/api/v1/ea/capability-mappings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].conceptId").value("concept-001"));
    }

    @Test
    void get_shouldReturnMapping() throws Exception {
        UUID id = UUID.randomUUID();
        MappingResponse response = MappingResponse.builder()
                .id(id)
                .conceptId("concept-001")
                .mappingType("DIRECT")
                .build();
        when(mappingService.get(id)).thenReturn(response);

        mockMvc.perform(get("/api/v1/ea/capability-mappings/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conceptId").value("concept-001"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        UpdateMappingRequest request = new UpdateMappingRequest();
        request.setMappingType("DERIVED");

        MappingResponse response = MappingResponse.builder()
                .id(id)
                .mappingType("DERIVED")
                .build();
        when(mappingService.update(eq(id), any(UpdateMappingRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/ea/capability-mappings/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mappingType").value("DERIVED"));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/api/v1/ea/capability-mappings/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void mapConcept_shouldReturn200() throws Exception {
        UUID capabilityId = UUID.randomUUID();
        MapConceptRequest request = new MapConceptRequest();
        request.setConceptId("concept-002");
        request.setMappingType("DERIVED");

        MappingResponse response = MappingResponse.builder()
                .id(UUID.randomUUID())
                .capabilityId(capabilityId)
                .conceptId("concept-002")
                .mappingType("DERIVED")
                .build();
        when(mappingService.mapConcept(eq(capabilityId), any(MapConceptRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/ea/capabilities/{id}/map-concept", capabilityId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.conceptId").value("concept-002"));
    }

    @Test
    void getConceptsForCapability_shouldReturnMappings() throws Exception {
        UUID capabilityId = UUID.randomUUID();
        when(mappingService.getConceptsForCapability(capabilityId)).thenReturn(List.of(
                MappingResponse.builder()
                        .id(UUID.randomUUID())
                        .capabilityId(capabilityId)
                        .conceptId("concept-001")
                        .mappingType("DIRECT")
                        .build()));

        mockMvc.perform(get("/api/v1/ea/capabilities/{id}/concepts", capabilityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].conceptId").value("concept-001"));
    }

    @Test
    void getCapabilitiesForConcept_shouldReturnMappings() throws Exception {
        String conceptId = "concept-001";
        when(mappingService.getCapabilitiesForConcept(conceptId)).thenReturn(List.of(
                MappingResponse.builder()
                        .id(UUID.randomUUID())
                        .capabilityId(UUID.randomUUID())
                        .conceptId(conceptId)
                        .mappingType("DIRECT")
                        .build()));

        mockMvc.perform(get("/api/v1/ea/concepts/{conceptId}/capabilities", conceptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].conceptId").value("concept-001"));
    }
}
