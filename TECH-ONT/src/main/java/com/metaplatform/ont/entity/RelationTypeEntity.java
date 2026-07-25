package com.metaplatform.ont.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import com.fasterxml.jackson.databind.JsonNode;

import com.metaplatform.ont.common.OntStatus;

@Entity
@Table(name = "ont_relation_type")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RelationTypeEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "relation_type_id", nullable = false, length = 64)
    private String relationTypeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_concept_id", nullable = false, length = 64)
    private String sourceConceptId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_concept_id", nullable = false, length = 64)
    private String targetConceptId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "direction", nullable = false, length = 32)
    private String direction;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "cardinality", nullable = false, length = 32)
    private String cardinality;

    @Column(name = "min_cardinality", nullable = false)
    private Integer minCardinality;

    @Column(name = "max_cardinality", nullable = false)
    private Integer maxCardinality;

    @Column(name = "symmetric_flag", nullable = false)
    private Boolean symmetric;

    @Column(name = "transitive", nullable = false)
    private Boolean transitive;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "inverse_relation_type_id", length = 64)
    private String inverseRelationTypeId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "attribute_ids", columnDefinition = "jsonb")
    private com.fasterxml.jackson.databind.JsonNode attributeIds;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
