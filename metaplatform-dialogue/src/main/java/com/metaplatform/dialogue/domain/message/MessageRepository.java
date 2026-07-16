package com.metaplatform.dialogue.domain.message;

import com.metaplatform.dialogue.domain.conversation.ConversationId;

import java.util.List;
import java.util.Optional;

/**
 * 消息仓库接口。
 */
public interface MessageRepository {
    void save(Message message);
    Optional<Message> findById(MessageId id);
    List<Message> findByConversationId(ConversationId conversationId);
    List<Message> findByConversationIdOrderByTimestamp(ConversationId conversationId);
    void deleteByConversationId(ConversationId conversationId);
}
