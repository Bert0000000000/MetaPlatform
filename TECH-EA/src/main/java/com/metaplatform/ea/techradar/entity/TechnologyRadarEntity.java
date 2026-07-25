package com.metaplatform.ea.techradar.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_technology_radar")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyRadarEntity {

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

    @Column(name = "quadrants", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String quadrants;

    @Column(name = "rings", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String rings;

    @Column(name = "items", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String items;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
