package com.metaplatform.dialogue.application;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.conversation.ConversationRepository;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.domain.message.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

/**
 * 上下文管理器。管理会话上下文，包括消息历史和上下文变量。
 */
@Service
public class ContextManager {

    private static final Logger log = LoggerFactory.getLogger(ContextManager.class);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Value("${dialogue.context.max-history-messages:50}")
    private int maxHistoryMessages;

    public ContextManager(ConversationRepository conversationRepository,
                          MessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * 获取会话的消息历史（按时间排序，受最大条数限制）。
     */
    public List<Message> getMessageHistory(ConversationId conversationId) {
        List<Message> messages = messageRepository.findByConversationIdOrderByTimestamp(conversationId);
        if (messages.size() > maxHistoryMessages) {
            messages = messages.subList(messages.size() - maxHistoryMessages, messages.size());
        }
        return messages;
    }

    /**
     * 将新消息添加到会话上下文中。
     */
    public void addMessage(Message message) {
        messageRepository.save(message);
        log.debug("Added message {} to conversation {}", message.id(), message.conversationId());
    }

    /**
     * 更新会话的上下文变量。
     */
    public void updateContext(Conversation conversation, String key, Object value) {
        conversation.setContextVariable(key, value);
        conversationRepository.save(conversation);
    }

    /**
     * 检查会话是否超时。
     */
    public boolean isSessionExpired(Conversation conversation) {
        return !conversation.isActive();
    }

    /**
     * 获取最近N条消息。
     */
    public List<Message> getRecentMessages(ConversationId conversationId, int count) {
        List<Message> messages = messageRepository.findByConversationIdOrderByTimestamp(conversationId);
        if (messages.size() <= count) {
            return messages;
        }
        return messages.subList(messages.size() - count, messages.size());
    }
}
