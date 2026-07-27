package com.metaplatform.ea.governance.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ea_health_score")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthScoreEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "score_date", nullable = false)
    private LocalDate scoreDate;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "dimension", nullable = false, length = 32)
    private String dimension;

    @Column(name = "score")
    private Double score;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metrics", columnDefinition = "TEXT")
    private String metrics;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
