package com.metaplatform.llmgw.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;

@Entity
@Table(name = "llmgw_cost_record")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CostRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "user_id", length = 100)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "app_id", length = 100)
    private String appId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "model_id", nullable = false, length = 100)
    private String modelId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "input_tokens", nullable = false)
    private Integer inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private Integer outputTokens;

    @Column(name = "input_cost", nullable = false)
    private BigDecimal inputCost;

    @Column(name = "output_cost", nullable = false)
    private BigDecimal outputCost;

    @Column(name = "total_cost", nullable = false)
    private BigDecimal totalCost;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Column(name = "billing_date", nullable = false)
    private LocalDate billingDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

}
