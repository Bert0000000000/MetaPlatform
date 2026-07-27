package com.metaplatform.copilot.repository;

import com.metaplatform.copilot.entity.ChatSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, Long> {
    List<ChatSessionEntity> findByUserIdOrderByLastMessageAtDesc(String userId);
    Optional<ChatSessionEntity> findBySessionId(String sessionId);
    void deleteBySessionId(String sessionId);
}