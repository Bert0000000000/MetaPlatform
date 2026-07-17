package com.metaplatform.ea.dataarchitecture.entity;

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
@Table(name = "ea_data_asset",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "code"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataAssetEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(name = "asset_type", nullable = false, length = 64)
    private String assetType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(length = 64)
    private String classification;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String metadata = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
