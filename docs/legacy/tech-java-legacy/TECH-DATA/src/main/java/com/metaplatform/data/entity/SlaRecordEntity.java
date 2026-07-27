package com.metaplatform.data.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "sla_record")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlaRecordEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_type", nullable = false, length = 32)
    private String targetType;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_id", nullable = false, length = 64)
    private String targetId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "metric", nullable = false, length = 64)
    private String metric;

    @Column(name = "threshold", nullable = false)
    private Double threshold;

    @Column(name = "actual")
    private Double actual;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "period", nullable = false, length = 32)
    private String period;

    @Column(name = "measured_at", nullable = false)
    private OffsetDateTime measuredAt;

}
