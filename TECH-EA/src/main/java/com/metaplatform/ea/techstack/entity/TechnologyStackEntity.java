package com.metaplatform.ea.techstack.entity;

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
@Table(name = "ea_technology_stack",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "name"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyStackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "application_id", length = 64)
    private String applicationId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "component_refs", columnDefinition = "jsonb")
    @Builder.Default
    private String componentRefs = "[]";

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "active";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
