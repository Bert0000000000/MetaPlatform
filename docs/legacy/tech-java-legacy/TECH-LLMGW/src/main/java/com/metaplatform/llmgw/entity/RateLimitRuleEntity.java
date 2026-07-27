package com.metaplatform.llmgw.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "llmgw_rate_limit_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope", nullable = false, length = 20)
    private String scope;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "scope_key", length = 100)
    private String scopeKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "model_id", length = 100)
    private String modelId;

    @Column(name = "rpm", nullable = false)
    private Integer rpm;

    @Column(name = "tpm")
    private Integer tpm;

    @Column(name = "concurrent")
    private Integer concurrent;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

}
