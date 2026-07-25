package com.metaplatform.copilot.controller;

import com.metaplatform.copilot.dto.ChatResponse;
import com.metaplatform.copilot.dto.FeedbackRequest;
import com.metaplatform.copilot.dto.SendMessageRequest;
import com.metaplatform.copilot.entity.ChatMessageEntity;
import com.metaplatform.copilot.entity.ChatSessionEntity;
import com.metaplatform.copilot.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/copilot/chat")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService service;

    @PostMapping("/sessions")
    public ChatSessionEntity createSession(@RequestParam String userId, @RequestParam(required = false) String title) {
        return service.createSession(userId, title);
    }

    @GetMapping("/sessions")
    public List<ChatSessionEntity> listSessions(@RequestParam String userId) {
        return service.listSessions(userId);
    }

    @GetMapping("/sessions/{sessionId}")
    public ChatSessionEntity getSession(@PathVariable String sessionId) {
        return service.getSession(sessionId);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public void deleteSession(@PathVariable String sessionId) {
        service.deleteSession(sessionId);
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public ChatResponse sendMessage(@PathVariable String sessionId, @RequestBody SendMessageRequest request) {
        return service.sendMessage(sessionId, request.userId(), request.content(), request.businessDomain());
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public List<ChatMessageEntity> listMessages(@PathVariable String sessionId) {
        return service.listMessages(sessionId);
    }

    @PostMapping("/messages/{messageId}/feedback")
    public ChatMessageEntity submitFeedback(@PathVariable String messageId, @RequestBody FeedbackRequest request) {
        return service.submitFeedback(messageId, request.rating(), request.feedback());
    }
}