package com.metaplatform.action.definition.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TraceFilter;
import com.metaplatform.action.definition.dto.ActionDefinitionListItem;
import com.metaplatform.action.definition.dto.ActionDefinitionResponse;
import com.metaplatform.action.definition.dto.CreateActionDefinitionRequest;
import com.metaplatform.action.definition.dto.UpdateActionDefinitionRequest;
import com.metaplatform.action.definition.service.ActionDefinitionService;
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

@WebMvcTest(controllers = ActionDefinitionController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = TraceFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ActionDefinitionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ActionDefinitionService actionDefinitionService;

    @Test
    void create_shouldReturn200() throws Exception {
        CreateActionDefinitionRequest request = new CreateActionDefinitionRequest();
        request.setCode("sendNotification");
        request.setName("发送通知");
        request.setMethod("POST");
        request.setUrl("https://notify.internal/api/v1/send");
        request.setInputSchema("{\"type\":\"object\"}");
        request.setOutputSchema("{\"type\":\"object\"}");

        ActionDefinitionResponse response = ActionDefinitionResponse.builder()
                .actionId("act-1")
                .code("sendNotification")
                .name("发送通知")
                .method("POST")
                .url("https://notify.internal/api/v1/send")
                .status("DRAFT")
                .version(1)
                .build();
        when(actionDefinitionService.create(any(CreateActionDefinitionRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/definitions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.actionId").value("act-1"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    void create_shouldReturn400_whenMissingRequiredField() throws Exception {
        CreateActionDefinitionRequest request = new CreateActionDefinitionRequest();
        request.setName("发送通知");

        mockMvc.perform(post("/api/v1/action/definitions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40001));
    }

    @Test
    void list_shouldReturnPagedResult() throws Exception {
        PageResponse<ActionDefinitionListItem> page = PageResponse.<ActionDefinitionListItem>builder()
                .items(List.of(ActionDefinitionListItem.builder()
                        .actionId("act-1")
                        .code("sendNotification")
                        .name("发送通知")
                        .status("PUBLISHED")
                        .version(2)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build()))
                .total(1).page(1).size(20).totalPages(1).build();
        when(actionDefinitionService.list(eq(null), eq(null), eq(null), eq(null))).thenReturn(page);

        mockMvc.perform(get("/api/v1/action/definitions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].code").value("sendNotification"));
    }

    @Test
    void get_shouldReturnAction() throws Exception {
        ActionDefinitionResponse response = ActionDefinitionResponse.builder()
                .actionId("act-1")
                .code("sendNotification")
                .name("发送通知")
                .status("PUBLISHED")
                .version(2)
                .build();
        when(actionDefinitionService.get("act-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/action/definitions/act-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.actionId").value("act-1"));
    }

    @Test
    void update_shouldReturn200() throws Exception {
        UpdateActionDefinitionRequest request = new UpdateActionDefinitionRequest();
        request.setName("发送通知（更新版）");

        ActionDefinitionResponse response = ActionDefinitionResponse.builder()
                .actionId("act-1")
                .name("发送通知（更新版）")
                .version(2)
                .build();
        when(actionDefinitionService.update(eq("act-1"), any(UpdateActionDefinitionRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/v1/action/definitions/act-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    void delete_shouldReturn200() throws Exception {
        mockMvc.perform(delete("/api/v1/action/definitions/act-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void publish_shouldReturnPublishedStatus() throws Exception {
        ActionDefinitionResponse response = ActionDefinitionResponse.builder()
                .actionId("act-1")
                .status("PUBLISHED")
                .version(1)
                .build();
        when(actionDefinitionService.publish("act-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/definitions/act-1/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
    }

    @Test
    void disable_shouldReturnDisabledStatus() throws Exception {
        ActionDefinitionResponse response = ActionDefinitionResponse.builder()
                .actionId("act-1")
                .status("DISABLED")
                .version(1)
                .build();
        when(actionDefinitionService.disable("act-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/action/definitions/act-1/disable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
    }
}
