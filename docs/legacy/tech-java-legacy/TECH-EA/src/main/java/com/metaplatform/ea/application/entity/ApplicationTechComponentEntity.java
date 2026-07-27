package com.metaplatform.ea.application.entity;

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
@Table(name = "ea_application_tech_component")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationTechComponentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Column(name = "tech_component_id", nullable = false)
    private UUID techComponentId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "relationship_type", nullable = false, length = 32)
    private String relationshipType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
