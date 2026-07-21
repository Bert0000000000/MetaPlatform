package com.metaplatform.ea.techcomponent.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_technology_component",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "name", "type"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyComponentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(length = 64)
    private String version;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 128)
    private String owner;

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
