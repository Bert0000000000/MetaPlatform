package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Cypher 查询模板（V12-05 REQ-063）。
 * 支持保存/分类/复用，分类包括概念查询、关系查询、路径查询、聚合查询。
 */
@Entity
@Table(name = "ont_cypher_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CypherTemplateEntity {

    @Id
    @Column(name = "template_id", nullable = false, length = 64)
    private String templateId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "category", nullable = false, length = 64)
    private String category;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "query", nullable = false, columnDefinition = "TEXT")
    private String query;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", columnDefinition = "jsonb")
    private JsonNode tags;

    @Column(name = "is_builtin", nullable = false)
    @Builder.Default
    private Boolean builtin = false;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
