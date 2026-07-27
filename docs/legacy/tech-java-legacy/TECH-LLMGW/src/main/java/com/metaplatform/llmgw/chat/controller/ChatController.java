package com.metaplatform.llmgw.chat.controller;

import com.metaplatform.llmgw.chat.dto.ChatCompletionRequest;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import com.metaplatform.llmgw.chat.service.ChatService;
import com.metaplatform.llmgw.chat.service.ChatStreamService;
import com.metaplatform.llmgw.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/llmgw/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ChatStreamService chatStreamService;

    @PostMapping
    public ApiResponse<ChatResponse> chat(@RequestBody ChatRequest request) {
        ChatResponse response = chatService.chat(request);
        return ApiResponse.ok(response);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> stream(@RequestBody ChatRequest request) {
        return chatStreamService.stream(request)
            .map(content -> ServerSentEvent.<String>builder()
                .data(content)
                .build());
    }

    @PostMapping("/completions")
    public ApiResponse<ChatResponse> completions(@RequestBody ChatCompletionRequest request) {
        Map<String, Object> metadata = new HashMap<>();
        if (request.user() != null && !request.user().isBlank()) {
            metadata.put("userId", request.user());
        }
        ChatRequest chatRequest = new ChatRequest(
            request.model(),
            request.messages(),
            request.temperature(),
            request.topP(),
            request.maxTokens(),
            null,
            request.stream(),
            metadata.isEmpty() ? null : metadata
        );
        ChatResponse response = chatService.chat(chatRequest);
        return ApiResponse.ok(response);
    }
}
