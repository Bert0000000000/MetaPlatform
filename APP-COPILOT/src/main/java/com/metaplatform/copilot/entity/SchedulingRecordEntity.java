package com.metaplatform.copilot.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "copilot_scheduling_records")
@Data
public class SchedulingRecordEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String recordId;
    private String sessionId;
    private String messageId;
    private String userId;
    @Column(columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String query;
    private String intentType;
    private String businessDomain;
    @Column(columnDefinition = "TEXT")
    private String agentIds;
    private String status;
    private long latencyMs;
    @Column(columnDefinition = "TEXT")
    private String result;
    @Column(columnDefinition = "TEXT")
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    @PrePersist
    void prePersist() {
        if (recordId == null) recordId = java.util.UUID.randomUUID().toString();
        if (startedAt == null) startedAt = LocalDateTime.now();
    }
}