package com.metaplatform.wfe.taskoperation.controller;

import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionResponse;
import com.metaplatform.wfe.taskoperation.service.EventSubscriptionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = EventSubscriptionController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.wfe.security.SecurityConfig.class,
                           com.metaplatform.wfe.security.JwtAuthenticationFilter.class,
                           com.metaplatform.wfe.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
class EventSubscriptionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EventSubscriptionService service;

    @Test
    void create_subscription_returns_200() throws Exception {
        when(service.create(any())).thenReturn(EventSubscriptionResponse.builder()
                .id("sub-1").userId("user-001")
                .eventTypes(List.of("TASK_COMPLETED"))
                .callbackUrl("https://example.com/cb").enabled(true)
                .createdAt(Instant.now()).updatedAt(Instant.now()).build());

        mockMvc.perform(post("/api/v1/wfe/event-subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventTypes\":[\"TASK_COMPLETED\"],\"callbackUrl\":\"https://example.com/cb\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("sub-1"));
    }

    @Test
    void list_returns_subscriptions() throws Exception {
        when(service.listMine()).thenReturn(List.of(EventSubscriptionResponse.builder()
                .id("sub-1").userId("user-001")
                .eventTypes(List.of("TASK_COMPLETED"))
                .callbackUrl("https://example.com/cb").enabled(true).build()));

        mockMvc.perform(get("/api/v1/wfe/event-subscriptions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void delete_returns_success() throws Exception {
        mockMvc.perform(delete("/api/v1/wfe/event-subscriptions/{id}", "sub-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void create_validation_error_when_callback_missing() throws Exception {
        mockMvc.perform(post("/api/v1/wfe/event-subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventTypes\":[\"TASK_COMPLETED\"]}"))
                .andExpect(status().isBadRequest());
    }
}