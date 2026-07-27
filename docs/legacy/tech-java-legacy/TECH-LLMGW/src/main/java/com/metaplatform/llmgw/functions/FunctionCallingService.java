package com.metaplatform.llmgw.functions;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Function Calling 服务：将平台原生能力（WebClient 调用 TECH-ONT/TECH-RAG 等）适配为 SAA ToolCallback。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FunctionCallingService {

    private final ChatClient.Builder chatClientBuilder;
    private final List<ToolProvider> toolProviders;

    /**
     * 注册工具：将 ToolProvider 列表转换为 ToolCallback[]。
     */
    public ToolCallback[] getAllToolCallbacks() {
        return toolProviders.stream()
            .flatMap(provider -> provider.provideTools().stream())
            .toArray(ToolCallback[]::new);
    }

    /**
     * 执行 Function Calling。
     */
    public String executeWithFunctions(String systemPrompt, String userMessage) {
        return chatClientBuilder.build()
            .prompt()
            .system(systemPrompt)
            .user(userMessage)
            .toolCallbacks(getAllToolCallbacks())
            .call()
            .content();
    }
}
