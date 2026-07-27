package com.metaplatform.msg.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "msg_consumer_group")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsumerGroupEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "group_id", nullable = false, length = 249)
    private String groupId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "topic_name", nullable = false, length = 249)
    private String topicName;

    @Column(name = "member_count", nullable = false)
    private Integer memberCount;

    @Column(name = "consumed_offset", nullable = false)
    private Long consumedOffset;

    @Column(name = "lag", nullable = false)
    private Long lag;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum ConsumerGroupStatus {
        ACTIVE,
        INACTIVE,
        PAUSED
    }
}
