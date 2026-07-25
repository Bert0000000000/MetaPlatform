package com.metaplatform.ont.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

import com.metaplatform.ont.common.OntStatus;

@Entity
@Table(name = "ont_relation_instance")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RelationInstanceEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "relation_instance_id", nullable = false, length = 64)
    private String relationInstanceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "relation_type_id", nullable = false, length = 64)
    private String relationTypeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source_entity_id", nullable = false, length = 64)
    private String sourceEntityId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_entity_id", nullable = false, length = 64)
    private String targetEntityId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "attributes", columnDefinition = "jsonb")
    private com.fasterxml.jackson.databind.JsonNode attributes;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private com.fasterxml.jackson.databind.JsonNode metadata;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private OntStatus status;

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
