package com.metaplatform.msg.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.msg.dto.AckRequest;
import com.metaplatform.msg.dto.AckResponse;
import com.metaplatform.msg.dto.ConsumerGroupRequest;
import com.metaplatform.msg.dto.ConsumerGroupResponse;
import com.metaplatform.msg.service.ConsumerGroupService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConsumerGroupController.class)
@AutoConfigureMockMvc(addFilters = false)
class ConsumerGroupControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ConsumerGroupService consumerGroupService;

    @Test
    void register_shouldReturn200_whenRequestIsValid() throws Exception {
        ConsumerGroupRequest request = ConsumerGroupRequest.builder()
                .tenantId("tenant-default")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .memberCount(3)
                .build();

        ConsumerGroupResponse response = ConsumerGroupResponse.builder()
                .id("cg-1")
                .tenantId("tenant-default")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .memberCount(3)
                .consumedOffset(0L)
                .lag(0L)
                .status("ACTIVE")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(consumerGroupService.register(any(ConsumerGroupRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/msg/consumer-groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("cg-1"))
                .andExpect(jsonPath("$.data.groupId").value("order-processor-group"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void ack_shouldReturn200_whenAckSucceeds() throws Exception {
        AckRequest request = AckRequest.builder()
                .consumedOffset(100L)
                .lag(5L)
                .build();

        AckResponse response = AckResponse.builder()
                .consumerGroupId("cg-1")
                .acknowledged(true)
                .consumedOffset(100L)
                .lag(5L)
                .ackedAt(Instant.now())
                .build();

        when(consumerGroupService.ack(eq("cg-1"), any(AckRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/msg/consumer-groups/cg-1/ack")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.acknowledged").value(true))
                .andExpect(jsonPath("$.data.consumedOffset").value(100));
    }

    @Test
    void get_shouldReturn200_whenConsumerGroupExists() throws Exception {
        ConsumerGroupResponse response = ConsumerGroupResponse.builder()
                .id("cg-1")
                .groupId("order-processor-group")
                .topicName("metaplatform.User.USER_REGISTERED")
                .lag(5L)
                .status("ACTIVE")
                .build();

        when(consumerGroupService.get("cg-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/msg/consumer-groups/cg-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("cg-1"))
                .andExpect(jsonPath("$.data.lag").value(5));
    }

    @Test
    void delete_shouldReturn200_whenConsumerGroupUnregistered() throws Exception {
        doNothing().when(consumerGroupService).unregister("cg-1");

        mockMvc.perform(delete("/api/v1/msg/consumer-groups/cg-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }
}
