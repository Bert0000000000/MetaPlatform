package com.metaplatform.action.definition.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "action_definitions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionDefinitionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "action_id", nullable = false, length = 64)
    private String actionId;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    private String method;

    @Column(nullable = false, length = 2048)
    private String url;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "headers", columnDefinition = "jsonb")
    private Map<String, Object> headers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_schema", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> inputSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_schema", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> outputSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ontology_binding", columnDefinition = "jsonb")
    private Map<String, Object> ontologyBinding;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "created_by", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}