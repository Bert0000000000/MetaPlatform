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
@Table(name = "quality_check")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QualityCheckEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "rule_id", nullable = false, length = 64)
    private String ruleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "asset_id", nullable = false, length = 64)
    private String assetId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "passed_records", nullable = false)
    private Long passedRecords;

    @Column(name = "failed_records", nullable = false)
    private Long failedRecords;

    @Column(name = "total_records", nullable = false)
    private Long totalRecords;

    @Column(name = "pass_rate", nullable = false)
    private Double passRate;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_samples", columnDefinition = "jsonb")
    private String errorSamples;

    @Column(name = "checked_at", nullable = false)
    private OffsetDateTime checkedAt;

}
