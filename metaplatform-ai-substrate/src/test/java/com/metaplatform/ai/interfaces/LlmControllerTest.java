package com.metaplatform.ai.interfaces;

import com.metaplatform.ai.billing.TokenBillingService;
import com.metaplatform.ai.interfaces.rest.LlmController;
import com.metaplatform.ai.interfaces.rest.dto.ChatRequest;
import com.metaplatform.ai.interfaces.rest.dto.ChatResponse;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(LlmController.class)
class LlmControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private LlmGateway llmGateway;

    @MockBean
    private TokenBillingService billingService;

    @Test
    void shouldReturnChatResponse() throws Exception {
        when(billingService.isQuotaExceeded(anyString())).thenReturn(false);
        when(llmGateway.chat(any(LlmRequest.class), anyString())).thenReturn(
                new LlmResponse("chatcmpl-123", "gpt-4o", "Hello!", "stop",
                        new LlmResponse.TokenUsage(10, 5, 15), Map.of()));

        ChatRequest request = new ChatRequest("smart",
                List.of(new ChatRequest.Message("user", "Hello")),
                0.7, 1024);

        mockMvc.perform(post("/api/v1/llm/chat")
                        .param("tenantId", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("chatcmpl-123"))
                .andExpect(jsonPath("$.model").value("gpt-4o"))
                .andExpect(jsonPath("$.content").value("Hello!"))
                .andExpect(jsonPath("$.totalTokens").value(15));
    }

    @Test
    void shouldReturn429WhenQuotaExceeded() throws Exception {
        when(billingService.isQuotaExceeded(anyString())).thenReturn(true);

        ChatRequest request = new ChatRequest("smart",
                List.of(new ChatRequest.Message("user", "Hello")),
                0.7, 1024);

        mockMvc.perform(post("/api/v1/llm/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isTooManyRequests());
    }
}
