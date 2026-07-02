package com.metaplatform.dialogue.infrastructure.memory;

import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.domain.message.MessageId;
import com.metaplatform.dialogue.domain.message.MessageRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * v0.1 简化：内存消息仓库。
 */
@Repository
public class InMemoryMessageRepository implements MessageRepository {
    private final ConcurrentMap<MessageId, Message> store = new ConcurrentHashMap<>();

    @Override
    public void save(Message message) {
        store.put(message.id(), message);
    }

    @Override
    public Optional<Message> findById(MessageId id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Message> findByConversationId(ConversationId conversationId) {
        return store.values().stream()
                .filter(m -> m.conversationId().equals(conversationId))
                .toList();
    }

    @Override
    public List<Message> findByConversationIdOrderByTimestamp(ConversationId conversationId) {
        return store.values().stream()
                .filter(m -> m.conversationId().equals(conversationId))
                .sorted(Comparator.comparing(m -> m.timestamp()))
                .toList();
    }

    @Override
    public void deleteByConversationId(ConversationId conversationId) {
        store.entrySet().removeIf(entry -> entry.getValue().conversationId().equals(conversationId));
    }
}
