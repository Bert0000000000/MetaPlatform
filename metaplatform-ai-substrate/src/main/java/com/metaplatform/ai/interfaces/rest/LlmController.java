package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.billing.TokenBillingService;
import com.metaplatform.ai.interfaces.rest.dto.ChatRequest;
import com.metaplatform.ai.interfaces.rest.dto.ChatResponse;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/llm")
public class LlmController {

    private final LlmGateway llmGateway;
    private final TokenBillingService billingService;

    public LlmController(LlmGateway llmGateway, TokenBillingService billingService) {
        this.llmGateway = llmGateway;
        this.billingService = billingService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            @RequestParam(defaultValue = "default") String tenantId) {

        // Check quota
        if (billingService.isQuotaExceeded(tenantId)) {
            return ResponseEntity.status(429).build();
        }

        List<LlmRequest.ChatMessage> messages = request.messages().stream()
                .map(m -> new LlmRequest.ChatMessage(m.role(), m.content()))
                .toList();

        LlmRequest llmRequest = new LlmRequest(
                request.model() != null ? request.model() : "smart",
                messages,
                request.temperature() != null ? request.temperature() : 0.7,
                request.maxTokens() != null ? request.maxTokens() : 1024,
                Map.of()
        );

        LlmResponse response = llmGateway.chat(llmRequest, tenantId);

        return ResponseEntity.ok(new ChatResponse(
                response.id(),
                response.model(),
                response.content(),
                response.finishReason(),
                response.usage().promptTokens(),
                response.usage().completionTokens(),
                response.usage().totalTokens()
        ));
    }
}
