package com.metaplatform.agent.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class ChatClientConfig {

    @Bean
    public ChatClient chatClient(ChatClient.Builder builder, List<ToolCallback> mcpToolCallbacks) {
        return builder
                .defaultOptions(ChatOptions.builder().model("qwen-max").temperature(0.7).build())
                .defaultTools(mcpToolCallbacks)
                .build();
    }
}