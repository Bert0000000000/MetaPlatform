package com.metaplatform.msg.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "msg_dlq_retry_policies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_dlq_policy_tenant_topic",
                columnNames = {"tenant_id", "topic"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DlqRetryPolicyEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @Builder.Default
    private String tenantId = "tenant-default";

    @Column(name = "topic", nullable = false, length = 256)
    private String topic;

    @Column(name = "max_retries", nullable = false)
    @Builder.Default
    private Integer maxRetries = 3;

    @Column(name = "retry_interval_seconds", nullable = false)
    @Builder.Default
    private Integer retryIntervalSeconds = 60;

    @Column(name = "retry_backoff_multiplier", nullable = false)
    @Builder.Default
    private Double retryBackoffMultiplier = 2.0;

    @Column(name = "auto_cleanup_days", nullable = false)
    @Builder.Default
    private Integer autoCleanupDays = 30;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
