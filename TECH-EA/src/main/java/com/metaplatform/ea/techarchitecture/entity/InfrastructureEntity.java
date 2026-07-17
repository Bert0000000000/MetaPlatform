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
@Table(name = "ea_infrastructure",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "code"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InfrastructureEntity {

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
    private String environment;

    @Column(length = 64)
    private String region;

    @Column(columnDefinition = "TEXT")
    private String description;

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