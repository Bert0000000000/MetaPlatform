package com.metaplatform.rule.decisiontable.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "rule_decision_table_row")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableRowEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "table_id", nullable = false, length = 64)
    private String tableId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "row_order")
    @Builder.Default
    private Integer rowOrder = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_values", columnDefinition = "jsonb")
    @Builder.Default
    private String inputValues = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_values", columnDefinition = "jsonb")
    @Builder.Default
    private String outputValues = "{}";

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
