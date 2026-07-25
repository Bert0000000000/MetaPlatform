package com.metaplatform.copilot.repository;

import com.metaplatform.copilot.entity.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findBySessionIdOrderByCreatedAtAsc(String sessionId);
    Optional<ChatMessageEntity> findByMessageId(String messageId);
}