package com.metaplatform.ai.llm;

import com.metaplatform.ai.billing.TokenBillingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LlmGatewayImpl implements LlmGateway {

    private static final Logger log = LoggerFactory.getLogger(LlmGatewayImpl.class);

    private final List<LlmAdapter> adapters;
    private final ModelAlias modelAlias;
    private final TokenBillingService billingService;

    public LlmGatewayImpl(List<LlmAdapter> adapters,
                           ModelAlias modelAlias,
                           TokenBillingService billingService) {
        this.adapters = adapters;
        this.modelAlias = modelAlias;
        this.billingService = billingService;
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        return chat(request, "default");
    }

    @Override
    public LlmResponse chat(LlmRequest request, String tenantId) {
        // 1. Resolve model alias
        String resolvedModel = modelAlias.resolve(request.model());

        // 2. Build resolved request
        LlmRequest resolvedRequest = new LlmRequest(
                resolvedModel, request.messages(), request.temperature(),
                request.maxTokens(), request.extra());

        // 3. Find adapter that supports this model
        LlmAdapter adapter = findAdapter(resolvedModel);

        // 4. Call LLM
        log.info("Calling LLM: model={}, adapter={}, tenant={}", resolvedModel, adapter.name(), tenantId);
        LlmResponse response = adapter.chat(resolvedRequest);

        // 5. Record token usage
        billingService.recordUsage(tenantId, resolvedModel,
                response.usage().promptTokens(), response.usage().completionTokens());

        return response;
    }

    private LlmAdapter findAdapter(String model) {
        return adapters.stream()
                .filter(a -> a.supportsModel(model))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "No LLM adapter found for model: " + model +
                        ". Available adapters: " + adapters.stream()
                                .map(LlmAdapter::name)
                                .toList()));
    }
}
