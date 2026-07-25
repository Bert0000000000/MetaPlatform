package com.metaplatform.ea.techarchitecture.entity;

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
@Table(name = "ea_tech_stack")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechStackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "category", length = 64)
    private String category;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "vendor", length = 64)
    private String vendor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "version", length = 64)
    private String version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "lifecycle_status", nullable = false, length = 32)
    private String lifecycleStatus;

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
