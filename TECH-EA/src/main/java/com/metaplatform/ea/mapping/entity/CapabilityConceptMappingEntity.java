package com.metaplatform.ea.mapping.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_capability_concept_mapping")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CapabilityConceptMappingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "capability_id", nullable = false)
    private UUID capabilityId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "concept_id", nullable = false, length = 128)
    private String conceptId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "concept_code", length = 128)
    private String conceptCode;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "mapping_type", nullable = false, length = 64)
    private String mappingType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
