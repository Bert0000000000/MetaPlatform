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
@Table(name = "agent_tools")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentToolEntity {

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "agentId", columnDefinition = "TEXT")
    private String agentId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "config", nullable = false, columnDefinition = "jsonb")
    private String config;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "createdAt", columnDefinition = "TEXT")
    private OffsetDateTime createdAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "deletedAt", columnDefinition = "TEXT")
    private OffsetDateTime deletedAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "enabled", columnDefinition = "TEXT")
    private String enabled;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "id", columnDefinition = "TEXT")
    private String id;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "inputSchema", columnDefinition = "TEXT")
    private String inputSchema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "input_schema", nullable = false, columnDefinition = "jsonb")
    private String input_schema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "name", columnDefinition = "TEXT")
    private String name;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "outputSchema", columnDefinition = "TEXT")
    private String outputSchema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "output_schema", nullable = false, columnDefinition = "jsonb")
    private String output_schema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tenantId", columnDefinition = "TEXT")
    private String tenantId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "toolType", columnDefinition = "TEXT")
    private String toolType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "updatedAt", columnDefinition = "TEXT")
    private OffsetDateTime updatedAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "version", columnDefinition = "TEXT")
    private String version;

}
