package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.conversation.ConversationRepository;
import com.metaplatform.dialogue.domain.conversation.ConversationStatus;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.message.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 会话服务。协调对话的完整生命周期：创建会话 -> 发送消息 -> 解析意图 -> 生成回复。
 */
@Service
public class ConversationService {

    private static final Logger log = LoggerFactory.getLogger(ConversationService.class);

    private final ConversationRepository conversationRepository;
    private final NaturalLanguageParser nlParser;
    private final ResponseGenerator responseGenerator;
    private final ContextManager contextManager;

    public ConversationService(ConversationRepository conversationRepository,
                               NaturalLanguageParser nlParser,
                               ResponseGenerator responseGenerator,
                               ContextManager contextManager) {
        this.conversationRepository = conversationRepository;
        this.nlParser = nlParser;
        this.responseGenerator = responseGenerator;
        this.contextManager = contextManager;
    }

    /**
     * 创建新会话。
     */
    public Conversation createConversation(String userId) {
        Conversation conversation = Conversation.create(userId);
        conversationRepository.save(conversation);
        log.info("Created conversation {} for user {}", conversation.id(), userId);
        return conversation;
    }

    /**
     * 发送用户消息并获取回复。核心流程：
     * 1. 保存用户消息
     * 2. 解析意图
     * 3. 生成回复
     * 4. 保存回复消息
     * 5. 返回回复
     */
    public Message sendMessage(ConversationId conversationId, String userText) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));

        if (!conversation.isActive()) {
            throw new IllegalStateException("Conversation is not active: " + conversationId);
        }

        // 1. 保存用户消息
        Message userMessage = Message.createUserMessage(conversationId, userText);
        contextManager.addMessage(userMessage);

        // 2. 解析意图
        Intent intent = nlParser.parse(userText);
        log.debug("Parsed intent: {} (confidence: {})", intent.name(), intent.confidence());

        // 3. 获取历史消息
        List<Message> history = contextManager.getMessageHistory(conversationId);

        // 4. 生成回复
        String responseText = responseGenerator.generate(conversation, intent, history);

        // 5. 保存回复消息
        Message assistantMessage = Message.createAssistantMessage(conversationId, responseText);
        assistantMessage.metadata().put("intent", intent.name());
        contextManager.addMessage(assistantMessage);

        // 6. 更新会话状态
        conversation.transitionTo(ConversationStatus.ACTIVE);
        conversationRepository.save(conversation);

        return assistantMessage;
    }

    /**
     * 获取会话详情。
     */
    public Conversation getConversation(ConversationId conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));
    }

    /**
     * 获取用户的所有会话。
     */
    public List<Conversation> getUserConversations(String userId) {
        return conversationRepository.findByUserId(userId);
    }

    /**
     * 关闭会话。
     */
    public void closeConversation(ConversationId conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));
        conversation.close();
        conversationRepository.save(conversation);
        log.info("Closed conversation {}", conversationId);
    }

    /**
     * 获取会话消息历史。
     */
    public List<Message> getMessages(ConversationId conversationId) {
        return contextManager.getMessageHistory(conversationId);
    }

    /**
     * 导出会话数据（含全部消息和上下文）。
     */
    public Map<String, Object> exportConversation(ConversationId conversationId) {
        Conversation conversation = getConversation(conversationId);
        List<Message> messages = getMessages(conversationId);
        return Map.of(
                "conversation", conversation,
                "messages", messages,
                "messageCount", messages.size()
        );
    }

    /**
     * 获取所有会话。
     */
    public List<Conversation> findAll() {
        return conversationRepository.findAll();
    }
}
