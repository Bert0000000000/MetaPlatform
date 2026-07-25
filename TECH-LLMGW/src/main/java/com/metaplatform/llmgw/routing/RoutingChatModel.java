package com.metaplatform.llmgw.routing;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * 多 LLM 路由层：根据模型名称路由到对应的 ChatModel 实现。
 *
 * <p>支持豆包/Qwen/DeepSeek/Claude/GPT 等多厂商模型，路由策略可扩展（成本/延迟/能力）。</p>
 */
@Primary
@Component
@RequiredArgsConstructor
public class RoutingChatModel implements ChatModel {

    private final List<ModelRouter> modelRouters;

    @Override
    public ChatResponse call(Prompt prompt) {
        return route(prompt).call(prompt);
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        return route(prompt).stream(prompt);
    }

    private ChatModel route(Prompt prompt) {
        String modelName = extractModelName(prompt);
        return modelRouters.stream()
            .filter(router -> router.supports(modelName))
            .findFirst()
            .map(router -> router.route(modelName))
            .orElseThrow(() -> new IllegalStateException("No router for model: " + modelName));
    }

    private String extractModelName(Prompt prompt) {
        if (prompt.getOptions() != null && prompt.getOptions().getModel() != null) {
            return prompt.getOptions().getModel();
        }
        return "qwen-max";
    }
}
