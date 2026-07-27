package com.metaplatform.data.mapping;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TraceFilter;
import com.metaplatform.data.mapping.dto.AutoDiscoverRequest;
import com.metaplatform.data.mapping.dto.AutoDiscoverResponse;
import com.metaplatform.data.mapping.dto.CreateDataMappingRequest;
import com.metaplatform.data.mapping.dto.CreateMappingFieldRequest;
import com.metaplatform.data.mapping.dto.DataMappingResponse;
import com.metaplatform.data.mapping.dto.MappingExecutionResponse;
import com.metaplatform.data.mapping.dto.MappingFieldResponse;
import com.metaplatform.data.mapping.dto.MappingValidationResult;
import com.metaplatform.data.mapping.dto.UpdateDataMappingRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DataMappingController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class DataMappingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DataMappingService dataMappingService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateDataMappingRequest request = new CreateDataMappingRequest(
                "用户映射", "描述", "ds-1", "users", "ent-user", "DRAFT", "MANUAL", null);
        DataMappingResponse response = new DataMappingResponse(
                "map-1", "用户映射", "描述", "ds-1", "users", "ent-user",
                "DRAFT", "MANUAL", null, OffsetDateTime.now(), OffsetDateTime.now());
        when(dataMappingService.create(any(CreateDataMappingRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/data/mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.mappingId").value("map-1"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateDataMappingRequest request = new CreateDataMappingRequest(
                "", null, null, null, null, null, null, null);

        mockMvc.perform(post("/api/v1/data/mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<DataMappingResponse> page = PageResponse.of(
                List.of(new DataMappingResponse("map-1", "用户映射", null, "ds-1", "users",
                        "ent-user", "ACTIVE", "MANUAL", null, null, null)),
                1, 1, 20);
        when(dataMappingService.list(eq(null), eq(null), eq(null), eq(1), eq(20))).thenReturn(page);

        mockMvc.perform(get("/api/v1/data/mappings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].mappingId").value("map-1"));
    }

    @Test
    void get_shouldReturnMapping() throws Exception {
        DataMappingResponse response = new DataMappingResponse(
                "map-1", "用户映射", null, "ds-1", "users", "ent-user",
                "ACTIVE", "MANUAL", null, null, null);
        when(dataMappingService.get("map-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/data/mappings/map-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mappingId").value("map-1"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UpdateDataMappingRequest request = new UpdateDataMappingRequest(
                "用户映射（更新）", null, "ACTIVE", null, null);
        DataMappingResponse response = new DataMappingResponse(
                "map-1", "用户映射（更新）", null, "ds-1", "users", "ent-user",
                "ACTIVE", "MANUAL", null, null, null);
        when(dataMappingService.update(eq("map-1"), any(UpdateDataMappingRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/data/mappings/map-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("用户映射（更新）"));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        when(dataMappingService.delete("map-1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/data/mappings/map-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.deleted").value(true));
    }

    @Test
    void addField_shouldReturn200() throws Exception {
        CreateMappingFieldRequest request = new CreateMappingFieldRequest(
                "user_name", "VARCHAR", "userName", "STRING", null, true);
        MappingFieldResponse response = new MappingFieldResponse(
                "fld-1", "map-1", "user_name", "VARCHAR", "userName", "STRING",
                null, true, null, null);
        when(dataMappingService.addField(eq("map-1"), any(CreateMappingFieldRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/data/mappings/map-1/fields")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fieldId").value("fld-1"));
    }

    @Test
    void listFields_shouldReturnFields() throws Exception {
        when(dataMappingService.listFields("map-1")).thenReturn(List.of(
                new MappingFieldResponse("fld-1", "map-1", "user_name", "VARCHAR",
                        "userName", "STRING", null, true, null, null)));

        mockMvc.perform(get("/api/v1/data/mappings/map-1/fields"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fieldId").value("fld-1"));
    }

    @Test
    void deleteField_shouldReturn200() throws Exception {
        when(dataMappingService.deleteField("map-1", "fld-1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/data/mappings/map-1/fields/fld-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(true));
    }

    @Test
    void execute_shouldReturnExecution() throws Exception {
        MappingExecutionResponse response = new MappingExecutionResponse(
                "mex-1", "map-1", "SUCCESS", 10L, 0L, OffsetDateTime.now(), OffsetDateTime.now(), null);
        when(dataMappingService.execute("map-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/data/mappings/map-1/execute"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("mex-1"))
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));
    }

    @Test
    void listExecutions_shouldReturnPagedResult() throws Exception {
        PageResponse<MappingExecutionResponse> page = PageResponse.of(
                List.of(new MappingExecutionResponse("mex-1", "map-1", "SUCCESS",
                        10L, 0L, null, null, null)), 1, 1, 20);
        when(dataMappingService.listExecutions(eq("map-1"), anyInt(), anyInt())).thenReturn(page);

        mockMvc.perform(get("/api/v1/data/mappings/map-1/executions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void validate_shouldReturnResult() throws Exception {
        MappingValidationResult result = new MappingValidationResult(
                true, 2, 2, 0, Collections.emptyList());
        when(dataMappingService.validate("map-1")).thenReturn(result);

        mockMvc.perform(post("/api/v1/data/mappings/map-1/validate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true))
                .andExpect(jsonPath("$.data.totalFields").value(2));
    }

    @Test
    void autoDiscover_shouldReturnRecommendations() throws Exception {
        AutoDiscoverRequest request = new AutoDiscoverRequest("ds-1", "users", "ent-user");
        AutoDiscoverResponse response = new AutoDiscoverResponse(
                "ds-1", "users", "ent-user", List.of(
                        new MappingFieldResponse(null, null, "user_name", "VARCHAR",
                                "userName", "STRING", null, true, null, null)));
        when(dataMappingService.autoDiscover(any(AutoDiscoverRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/data/mappings/auto-discover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.datasourceId").value("ds-1"))
                .andExpect(jsonPath("$.data.recommendedFields[0].sourceField").value("user_name"));
    }
}
