package com.metaplatform.dialogue.interfaces.rest;

import com.metaplatform.dialogue.application.ConversationService;
import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.interfaces.rest.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 会话 REST 控制器。提供会话管理和消息交互的 API。
 */
@RestController
@RequestMapping("/api/v1")
public class ConversationController {

    private static final Logger log = LoggerFactory.getLogger(ConversationController.class);

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    /**
     * POST /api/v1/conversations - 创建新会话
     */
    @PostMapping("/conversations")
    public ResponseEntity<ConversationResponse> createConversation(
            @RequestBody(required = false) CreateConversationRequest request) {
        String userId = (request != null && request.userId() != null) ? request.userId() : "anonymous";
        Conversation conversation = conversationService.createConversation(userId);
        log.info("Created conversation: {}", conversation.id());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ConversationResponse.from(conversation));
    }

    /**
     * GET /api/v1/conversations/{id} - 获取会话详情
     */
    @GetMapping("/conversations/{id}")
    public ResponseEntity<ConversationResponse> getConversation(@PathVariable String id) {
        try {
            Conversation conversation = conversationService.getConversation(ConversationId.of(id));
            return ResponseEntity.ok(ConversationResponse.from(conversation));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/v1/conversations - 获取所有会话
     */
    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationResponse>> listConversations(
            @RequestParam(required = false) String userId) {
        List<Conversation> conversations;
        if (userId != null && !userId.isBlank()) {
            conversations = conversationService.getUserConversations(userId);
        } else {
            conversations = conversationService.findAll();
        }
        return ResponseEntity.ok(conversations.stream()
                .map(ConversationResponse::from)
                .toList());
    }

    /**
     * POST /api/v1/conversations/{id}/messages - 发送消息并获取回复
     */
    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable String id,
            @RequestBody SendMessageRequest request) {
        try {
            Message reply = conversationService.sendMessage(ConversationId.of(id), request.content());
            return ResponseEntity.ok(MessageResponse.from(reply));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    /**
     * GET /api/v1/conversations/{id}/messages - 获取会话消息历史
     */
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable String id) {
        try {
            List<Message> messages = conversationService.getMessages(ConversationId.of(id));
            return ResponseEntity.ok(messages.stream()
                    .map(MessageResponse::from)
                    .toList());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/v1/conversations/{id}/close - 关闭会话
     */
    @PostMapping("/conversations/{id}/close")
    public ResponseEntity<Void> closeConversation(@PathVariable String id) {
        try {
            conversationService.closeConversation(ConversationId.of(id));
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/v1/conversations/{id}/export - 导出会话数据
     */
    @GetMapping("/conversations/{id}/export")
    public ResponseEntity<Map<String, Object>> exportConversation(@PathVariable String id) {
        try {
            Map<String, Object> data = conversationService.exportConversation(ConversationId.of(id));
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
