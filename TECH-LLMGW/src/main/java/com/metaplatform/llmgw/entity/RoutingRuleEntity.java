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
@Table(name = "llmgw_routing_rule")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoutingRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "priority", nullable = false)
    private Integer priority;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "condition_type", nullable = false, length = 50)
    private String conditionType;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "condition_value", nullable = false, columnDefinition = "jsonb")
    private String conditionValue;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_model", nullable = false, length = 100)
    private String targetModel;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

}
