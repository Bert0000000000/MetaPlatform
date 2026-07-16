package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.ont.common.OntStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "ont_entities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EntityEntity {

    @Id
    @Column(name = "entity_id", nullable = false, length = 64)
    private String entityId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "concept_id", nullable = false, length = 64)
    private String conceptId;

    @Column(name = "code", length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private JsonNode metadata;

    @Column(name = "status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OntStatus status = OntStatus.ACTIVE;

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
