package com.metaplatform.action.trigger.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TraceFilter;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.trigger.dto.CreateTriggerRequest;
import com.metaplatform.action.trigger.dto.TriggerListItem;
import com.metaplatform.action.trigger.dto.TriggerResponse;
import com.metaplatform.action.trigger.dto.UpdateTriggerRequest;
import com.metaplatform.action.trigger.service.ActionTriggerService;
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

@WebMvcTest(controllers = ActionTriggerController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ActionTriggerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ActionTriggerService actionTriggerService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setActionId("act-1");
        request.setName("event-trigger");
        request.setTriggerType("EVENT");
        request.setEventTopic("order.created");

        TriggerResponse response = TriggerResponse.builder()
                .triggerId("trg-1")
                .actionId("act-1")
                .name("event-trigger")
                .triggerType("EVENT")
                .eventTopic("order.created")
                .enabled(true)
                .build();
        when(actionTriggerService.create(any(CreateTriggerRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/triggers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.triggerId").value("trg-1"))
                .andExpect(jsonPath("$.data.triggerType").value("EVENT"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateTriggerRequest request = new CreateTriggerRequest();
        request.setName("event-trigger");

        mockMvc.perform(post("/api/v1/action/triggers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<TriggerListItem> page = PageResponse.<TriggerListItem>builder()
                .items(List.of(TriggerListItem.builder()
                        .triggerId("trg-1")
                        .actionId("act-1")
                        .name("event-trigger")
                        .triggerType("EVENT")
                        .enabled(true)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(actionTriggerService.list(eq(null), eq(null), eq(null), eq(null), eq(null)))
                .thenReturn(page);

        mockMvc.perform(get("/api/v1/action/triggers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].triggerId").value("trg-1"));
    }

    @Test
    void get_shouldReturnTrigger() throws Exception {
        TriggerResponse response = TriggerResponse.builder()
                .triggerId("trg-1")
                .actionId("act-1")
                .name("event-trigger")
                .triggerType("EVENT")
                .enabled(true)
                .build();
        when(actionTriggerService.get("trg-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/action/triggers/trg-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.triggerId").value("trg-1"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UpdateTriggerRequest request = new UpdateTriggerRequest();
        request.setName("updated-trigger");

        TriggerResponse response = TriggerResponse.builder()
                .triggerId("trg-1")
                .name("updated-trigger")
                .build();
        when(actionTriggerService.update(eq("trg-1"), any(UpdateTriggerRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/action/triggers/trg-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("updated-trigger"));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        mockMvc.perform(delete("/api/v1/action/triggers/trg-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void enable_shouldReturnEnabledStatus() throws Exception {
        TriggerResponse response = TriggerResponse.builder()
                .triggerId("trg-1")
                .enabled(true)
                .build();
        when(actionTriggerService.enable("trg-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/triggers/trg-1/enable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(true));
    }

    @Test
    void disable_shouldReturnDisabledStatus() throws Exception {
        TriggerResponse response = TriggerResponse.builder()
                .triggerId("trg-1")
                .enabled(false)
                .build();
        when(actionTriggerService.disable("trg-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/triggers/trg-1/disable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled").value(false));
    }

    @Test
    void fire_shouldReturnExecutionResponse() throws Exception {
        SyncExecutionResponse response = SyncExecutionResponse.builder()
                .executionId("exec-1")
                .actionCode("sendNotification")
                .status("COMPLETED")
                .build();
        when(actionTriggerService.fire("trg-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/triggers/trg-1/fire"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.executionId").value("exec-1"))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }
}
