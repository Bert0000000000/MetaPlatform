package com.metaplatform.ai.llm;

import com.metaplatform.ai.billing.TokenBillingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LlmGatewayImplTest {

    @Mock
    private ModelAlias modelAlias;

    @Mock
    private TokenBillingService billingService;

    @Mock
    private LlmAdapter openAiAdapter;

    @Mock
    private LlmAdapter anthropicAdapter;

    private LlmGatewayImpl gateway;

    @BeforeEach
    void setUp() {
        gateway = new LlmGatewayImpl(
                List.of(openAiAdapter, anthropicAdapter),
                modelAlias,
                billingService);
    }

    @Test
    void shouldRouteToCorrectAdapter() {
        when(modelAlias.resolve("fast")).thenReturn("gpt-3.5-turbo");
        when(openAiAdapter.supportsModel("gpt-3.5-turbo")).thenReturn(true);
        when(openAiAdapter.chat(any())).thenReturn(
                new LlmResponse("id-1", "gpt-3.5-turbo", "Hi", "stop",
                        new LlmResponse.TokenUsage(10, 5, 15), Map.of()));

        LlmResponse response = gateway.chat(LlmRequest.simple("fast", "Hello"), "tenant-1");

        assertEquals("Hi", response.content());
        verify(billingService).recordUsage("tenant-1", "gpt-3.5-turbo", 10, 5);
    }

    @Test
    void shouldResolveModelAlias() {
        when(modelAlias.resolve("smart")).thenReturn("gpt-4o");
        when(openAiAdapter.supportsModel("gpt-4o")).thenReturn(true);
        when(openAiAdapter.chat(any())).thenReturn(
                new LlmResponse("id-2", "gpt-4o", "Result", "stop",
                        new LlmResponse.TokenUsage(20, 10, 30), Map.of()));

        gateway.chat(LlmRequest.simple("smart", "test"), "tenant-1");

        verify(modelAlias).resolve("smart");
        verify(openAiAdapter).chat(argThat(req -> "gpt-4o".equals(req.model())));
    }

    @Test
    void shouldThrowWhenNoAdapterFound() {
        when(modelAlias.resolve("unknown")).thenReturn("unknown-model");
        when(openAiAdapter.supportsModel("unknown-model")).thenReturn(false);
        when(anthropicAdapter.supportsModel("unknown-model")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () ->
                gateway.chat(LlmRequest.simple("unknown", "test")));
    }
}
