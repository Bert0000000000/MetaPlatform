package com.metaplatform.dialogue.domain.conversation;

import java.util.List;
import java.util.Optional;

/**
 * 会话仓库接口。
 */
public interface ConversationRepository {
    void save(Conversation conversation);
    Optional<Conversation> findById(ConversationId id);
    List<Conversation> findByUserId(String userId);
    List<Conversation> findAll();
    void deleteById(ConversationId id);
}
