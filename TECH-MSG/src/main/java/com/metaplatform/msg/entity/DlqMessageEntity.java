package com.metaplatform.msg.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "msg_dlq_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DlqMessageEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @Builder.Default
    private String tenantId = "tenant-default";

    @Column(name = "original_topic", nullable = false, length = 256)
    private String originalTopic;

    @Column(name = "original_message_key", length = 256)
    private String originalMessageKey;

    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "headers", columnDefinition = "TEXT")
    private String headers;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "error_class", length = 256)
    private String errorClass;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DlqStatus status = DlqStatus.PENDING;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @Column(name = "first_failed_at")
    private Instant firstFailedAt;

    @Column(name = "last_failed_at")
    private Instant lastFailedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum DlqStatus {
        PENDING,
        RESENDING,
        RESENT,
        DEAD
    }
}
