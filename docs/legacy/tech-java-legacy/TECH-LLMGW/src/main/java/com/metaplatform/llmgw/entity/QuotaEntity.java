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

@Entity
@Table(name = "llmgw_quota")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope", nullable = false, length = 20)
    private String scope;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope_key", nullable = false, length = 100)
    private String scopeKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "model_id", length = 100)
    private String modelId;

    @Column(name = "daily_token_limit")
    private Long dailyTokenLimit;

    @Column(name = "monthly_token_limit")
    private Long monthlyTokenLimit;

    @Column(name = "daily_request_limit")
    private Integer dailyRequestLimit;

    @Column(name = "monthly_request_limit")
    private Integer monthlyRequestLimit;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

}
