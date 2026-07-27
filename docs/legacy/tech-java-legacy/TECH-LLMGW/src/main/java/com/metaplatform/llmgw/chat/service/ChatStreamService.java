package com.metaplatform.llmgw.chat.service;

import com.metaplatform.llmgw.chat.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatStreamService {

    private final ChatModel chatModel;
    private final ChatMessageConverter chatMessageConverter;

    public Flux<String> stream(ChatRequest request) {
        List<Message> messages = chatMessageConverter.toSpringAiMessages(request.messages());
        ChatOptions options = ChatOptions.builder()
            .model(request.model())
            .temperature(request.temperature())
            .topP(request.topP())
            .maxTokens(request.maxTokens())
            .stopSequences(request.stop())
            .build();
        Prompt prompt = new Prompt(messages, options);
        return chatModel.stream(prompt)
            .map(chunk -> {
                if (chunk == null || chunk.getResult() == null || chunk.getResult().getOutput() == null) {
                    return "";
                }
                String text = chunk.getResult().getOutput().getText();
                return text == null ? "" : text;
            });
    }
}
