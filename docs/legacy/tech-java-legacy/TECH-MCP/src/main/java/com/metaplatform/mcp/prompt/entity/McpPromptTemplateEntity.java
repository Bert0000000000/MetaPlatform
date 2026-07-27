package com.metaplatform.mcp.prompt.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mcp_prompt_template")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpPromptTemplateEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(nullable = false, length = 200)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String name;

    @Column(nullable = false, length = 128)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String code;

    @Column(length = 32)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String category;

    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String language;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "template", columnDefinition = "TEXT")
    private String template;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "variables", columnDefinition = "jsonb")
    private String variables;

    @Column(nullable = false)
    private Integer version;

    @Column(nullable = false, length = 32)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String status;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
