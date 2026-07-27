package com.metaplatform.llmgw.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "llmgw_model")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "model_id", nullable = false, length = 100)
    private String modelId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "modality", nullable = false, length = 20)
    private String modality;

    @Column(name = "context_window")
    private Integer contextWindow;

    @Column(name = "max_output_tokens")
    private Integer maxOutputTokens;

    @Column(name = "input_price_per_1k")
    private BigDecimal inputPricePer1k;

    @Column(name = "output_price_per_1k")
    private BigDecimal outputPricePer1k;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "capabilities", columnDefinition = "jsonb")
    private String capabilities;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

}
