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
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false, columnDefinition = "TEXT")
    private String template;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    private String variables;

    @Column(nullable = false)
    private Integer version;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(length = 64)
    private String category;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}