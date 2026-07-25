package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dashboard_metric_configs")
@Data
public class MetricConfigEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String userId;

    @Column(name = "metric_id", nullable = false, length = 128)
    private String metricId;

    @Column(name = "metric_name", length = 256)
    private String metricName;

    @Column(nullable = false)
    private Boolean visible;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(nullable = false, length = 16)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String size;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (visible == null) visible = true;
        if (sortOrder == null) sortOrder = 0;
        if (size == null) size = "MEDIUM";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
