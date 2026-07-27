package com.metaplatform.ea.ontmapping.entity;

import com.fasterxml.jackson.databind.JsonNode;

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
@Table(name = "ea_ontology_mapping_rule",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "asset_type", "asset_id", "concept_id"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptMappingRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String tenantId;

    @Column(name = "asset_type", nullable = false, length = 64)
    private String assetType;

    @Column(name = "asset_id", nullable = false)
    private UUID assetId;

    @Column(name = "asset_name", length = 256)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String assetName;

    @Column(name = "concept_id", nullable = false, length = 128)
    private String conceptId;

    @Column(name = "concept_code", length = 128)
    private String conceptCode;

    @Column(name = "mapping_type", nullable = false, length = 64)
    private String mappingType;

    @Column(name = "description", length = 1024)
    private String description;


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
