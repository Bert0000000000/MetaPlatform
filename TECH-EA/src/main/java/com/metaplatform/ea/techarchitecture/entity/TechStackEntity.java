package com.metaplatform.ea.techarchitecture.entity;

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
@Table(name = "ea_tech_stack",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "code"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechStackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(length = 64)
    private String category;

    @Column(length = 64)
    private String vendor;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "version", length = 64)
    private String version;

    @Column(name = "lifecycle_status", length = 32)
    @Builder.Default
    private String lifecycleStatus = "ACTIVE";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private String metadata = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}