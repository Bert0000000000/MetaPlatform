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
@Table(name = "agent_definition")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentDefinitionEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "agent_code", nullable = false, length = 128)
    private String agentCode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "model_id", nullable = false, length = 256)
    private String modelId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "system_prompt", nullable = false, length = 8192)
    private String systemPrompt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tools", nullable = false, columnDefinition = "jsonb")
    private String tools;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "rag_scopes", nullable = false, columnDefinition = "jsonb")
    private String ragScopes;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "temperature", nullable = false, length = 16)
    private String temperature;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "max_tokens", nullable = false, length = 16)
    private String maxTokens;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
