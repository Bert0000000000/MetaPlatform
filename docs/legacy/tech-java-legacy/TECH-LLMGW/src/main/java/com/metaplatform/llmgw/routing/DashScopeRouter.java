package com.metaplatform.llmgw.routing;

import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatModel;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * DashScope 模型路由器。
 */
@Component
@RequiredArgsConstructor
public class DashScopeRouter implements ModelRouter {

    private static final Set<String> SUPPORTED_PREFIXES = Set.of("qwen", "deepseek");

    private final DashScopeChatModel dashScopeChatModel;

    @Override
    public boolean supports(String modelName) {
        if (modelName == null) {
            return false;
        }
        String normalizedModelName = modelName.toLowerCase(Locale.ROOT);
        return SUPPORTED_PREFIXES.stream().anyMatch(normalizedModelName::startsWith);
    }

    @Override
    public ChatModel route(String modelName) {
        return dashScopeChatModel;
    }
}
