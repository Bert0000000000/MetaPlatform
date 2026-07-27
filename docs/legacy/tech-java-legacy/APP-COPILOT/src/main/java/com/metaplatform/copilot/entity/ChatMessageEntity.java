package com.metaplatform.copilot.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "copilot_chat_messages")
@Data
public class ChatMessageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String messageId;
    private String sessionId;
    private String role;
    @Column(columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String content;
    @Column(columnDefinition = "TEXT")
    private String citations;
    @Column(columnDefinition = "TEXT")
    private String agentCalls;
    private Integer rating;
    @Column(columnDefinition = "TEXT")
    private String feedback;
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (messageId == null) messageId = java.util.UUID.randomUUID().toString();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}