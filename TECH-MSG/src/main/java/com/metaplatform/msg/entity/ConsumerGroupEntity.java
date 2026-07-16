package com.metaplatform.msg.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "msg_consumer_group",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_cg_tenant_group_topic",
                columnNames = {"tenant_id", "group_id", "topic_name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumerGroupEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @Builder.Default
    private String tenantId = "tenant-default";

    @Column(name = "group_id", nullable = false, length = 249)
    private String groupId;

    @Column(name = "topic_name", nullable = false, length = 249)
    private String topicName;

    @Column(name = "member_count", nullable = false)
    @Builder.Default
    private Integer memberCount = 0;

    @Column(name = "consumed_offset", nullable = false)
    @Builder.Default
    private Long consumedOffset = 0L;

    @Column(name = "lag", nullable = false)
    @Builder.Default
    private Long lag = 0L;

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ConsumerGroupStatus status = ConsumerGroupStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum ConsumerGroupStatus {
        ACTIVE,
        INACTIVE
    }
}
