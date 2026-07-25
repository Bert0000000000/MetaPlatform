package com.metaplatform.iam.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Outbox 消息实体（S-IAM-05）。
 *
 * <p>业务事务中将事件写入此表（status=PENDING），由 {@code IamOutboxService.relay()}
 * 定时轮询投递到 Kafka。投递成功 status=SENT，失败 retry_count++，超过 max_retries
 * 则 status=FAILED。</p>
 */
@Entity
@Table(name = "iam_outbox_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IamOutboxEntity {

    public enum Status { PENDING, SENT, FAILED }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "aggregate_type", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String aggregateId;

    @Column(name = "event_type", nullable = false, length = 128)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String eventType;

    @Column(name = "topic", nullable = false, length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String topic;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "TEXT")
    private Map<String, Object> payload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "headers", columnDefinition = "TEXT")
    private Map<String, Object> headers;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private Status status;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount;

    @Column(name = "max_retries", nullable = false)
    private Integer maxRetries;

    @Column(name = "trace_id", length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String traceId;

    @Column(name = "last_error", length = 1024)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String lastError;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "sent_at")
    private Instant sentAt;
}