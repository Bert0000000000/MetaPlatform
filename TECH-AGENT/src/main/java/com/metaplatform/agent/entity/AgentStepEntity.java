package com.metaplatform.agent.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "agent_steps")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentStepEntity {

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "completedAt", columnDefinition = "TEXT")
    private OffsetDateTime completedAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "createdAt", columnDefinition = "TEXT")
    private OffsetDateTime createdAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "durationMs", columnDefinition = "TEXT")
    private Long durationMs;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "errorMessage", columnDefinition = "TEXT")
    private String errorMessage;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "executionId", columnDefinition = "TEXT")
    private String executionId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "id", columnDefinition = "TEXT")
    private String id;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "sortOrder", columnDefinition = "TEXT")
    private Integer sortOrder;

    @Column(name = "sort_order", nullable = false)
    private Integer sort_order;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "startedAt", columnDefinition = "TEXT")
    private OffsetDateTime startedAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "status", columnDefinition = "TEXT")
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "stepType", columnDefinition = "TEXT")
    private String stepType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tenantId", columnDefinition = "TEXT")
    private String tenantId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "toolInput", columnDefinition = "TEXT")
    private String toolInput;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "toolName", columnDefinition = "TEXT")
    private String toolName;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "toolOutput", columnDefinition = "TEXT")
    private String toolOutput;

}
