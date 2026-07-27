package com.metaplatform.action.orchestration.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TraceFilter;
import com.metaplatform.action.orchestration.dto.CreateOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.OrchestrationExecutionResponse;
import com.metaplatform.action.orchestration.dto.OrchestrationListItem;
import com.metaplatform.action.orchestration.dto.OrchestrationResponse;
import com.metaplatform.action.orchestration.dto.StartOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.UpdateOrchestrationRequest;
import com.metaplatform.action.orchestration.service.OrchestrationExecutionService;
import com.metaplatform.action.orchestration.service.OrchestrationService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = OrchestrationController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class OrchestrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OrchestrationService orchestrationService;

    @MockBean
    private OrchestrationExecutionService orchestrationExecutionService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateOrchestrationRequest request = new CreateOrchestrationRequest();
        request.setCode("orderFlow");
        request.setName("订单流程");

        OrchestrationResponse response = OrchestrationResponse.builder()
                .orchestrationId("orch-1")
                .code("orderFlow")
                .name("订单流程")
                .status("DRAFT")
                .version(1)
                .build();
        when(orchestrationService.create(any(CreateOrchestrationRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/orchestrations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.orchestrationId").value("orch-1"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<OrchestrationListItem> page = PageResponse.<OrchestrationListItem>builder()
                .items(List.of(OrchestrationListItem.builder()
                        .orchestrationId("orch-1")
                        .code("orderFlow")
                        .name("订单流程")
                        .status("PUBLISHED")
                        .version(2)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(orchestrationService.list(eq(null), eq(null), eq(null), eq(null))).thenReturn(page);

        mockMvc.perform(get("/api/v1/action/orchestrations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].code").value("orderFlow"));
    }

    @Test
    void get_shouldReturnOrchestration() throws Exception {
        OrchestrationResponse response = OrchestrationResponse.builder()
                .orchestrationId("orch-1")
                .code("orderFlow")
                .status("PUBLISHED")
                .version(2)
                .build();
        when(orchestrationService.get("orch-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/action/orchestrations/orch-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orchestrationId").value("orch-1"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UpdateOrchestrationRequest request = new UpdateOrchestrationRequest();
        request.setName("订单流程（更新）");

        OrchestrationResponse response = OrchestrationResponse.builder()
                .orchestrationId("orch-1")
                .name("订单流程（更新）")
                .version(2)
                .build();
        when(orchestrationService.update(eq("orch-1"), any(UpdateOrchestrationRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/action/orchestrations/orch-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        mockMvc.perform(delete("/api/v1/action/orchestrations/orch-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void execute_shouldReturnExecutionId() throws Exception {
        StartOrchestrationRequest request = new StartOrchestrationRequest();
        request.setInput(java.util.Map.of("orderId", "123"));

        when(orchestrationExecutionService.startExecution(eq("orch-1"), any(StartOrchestrationRequest.class)))
                .thenReturn("orch-exec-1");

        mockMvc.perform(post("/api/v1/action/orchestrations/orch-1/execute")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("orch-exec-1"));
    }

    @Test
    void getExecution_shouldReturnResponse() throws Exception {
        OrchestrationExecutionResponse response = OrchestrationExecutionResponse.builder()
                .executionId("orch-exec-1")
                .orchestrationId("orch-1")
                .status("COMPLETED")
                .build();
        when(orchestrationExecutionService.getExecution("orch-exec-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/action/orchestrations/executions/orch-exec-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("orch-exec-1"))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }
}
