package com.metaplatform.dialogue.infrastructure.memory;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationId;
import com.metaplatform.dialogue.domain.conversation.ConversationRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * v0.1 简化：内存会话仓库。
 */
@Repository
public class InMemoryConversationRepository implements ConversationRepository {
    private final ConcurrentMap<ConversationId, Conversation> store = new ConcurrentHashMap<>();

    @Override
    public void save(Conversation conversation) {
        store.put(conversation.id(), conversation);
    }

    @Override
    public Optional<Conversation> findById(ConversationId id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Conversation> findByUserId(String userId) {
        return store.values().stream()
                .filter(c -> c.userId().equals(userId))
                .toList();
    }

    @Override
    public List<Conversation> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void deleteById(ConversationId id) {
        store.remove(id);
    }
}
