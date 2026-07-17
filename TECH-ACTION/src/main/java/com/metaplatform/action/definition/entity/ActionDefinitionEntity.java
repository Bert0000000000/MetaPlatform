package com.metaplatform.action.definition.entity;

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

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "headers", columnDefinition = "jsonb")
    private String headers;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "input_schema", columnDefinition = "jsonb", nullable = false)
    private String inputSchema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "output_schema", columnDefinition = "jsonb", nullable = false)
    private String outputSchema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "ontology_binding", columnDefinition = "jsonb")
    private String ontologyBinding;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "created_by", nullable = false, length = 64)
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
