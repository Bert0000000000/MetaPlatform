package com.metaplatform.rule.decisiontable.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.time.Instant;

@Entity
@Table(name = "rule_decision_table_row")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableRowEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "table_id", nullable = false, length = 64)
    private String tableId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "row_order", nullable = false)
    private Integer rowOrder;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_values", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> inputValues;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_values", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> outputValues;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
