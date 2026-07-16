package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "ont_relation_type")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RelationTypeEntity {

    @Id
    @Column(name = "relation_type_id", nullable = false, length = 64)
    private String relationTypeId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "source_concept_id", nullable = false, length = 64)
    private String sourceConceptId;

    @Column(name = "target_concept_id", nullable = false, length = 64)
    private String targetConceptId;

    @Column(name = "direction", nullable = false, length = 32)
    @Builder.Default
    private String direction = "DIRECTED";

    @Column(name = "cardinality", nullable = false, length = 32)
    @Builder.Default
    private String cardinality = "MANY_TO_MANY";

    @Column(name = "min_cardinality", nullable = false)
    @Builder.Default
    private Integer minCardinality = 0;

    @Column(name = "max_cardinality", nullable = false)
    @Builder.Default
    private Integer maxCardinality = 0;

    @Column(name = "symmetric", nullable = false)
    @Builder.Default
    private Boolean symmetric = false;

    @Column(name = "transitive", nullable = false)
    @Builder.Default
    private Boolean transitive = false;

    @Column(name = "inverse_relation_type_id", length = 64)
    private String inverseRelationTypeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attribute_ids", columnDefinition = "jsonb")
    private JsonNode attributeIds;

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