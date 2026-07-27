package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "dashboard_page_stat")
@Data
public class DashboardPageStatEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(nullable = false, length = 64)
    private String label;

    @Column(nullable = false, length = 32)
    private String value;

    @Column(name = "trend_label", length = 64)
    private String trendLabel;

    @Column(name = "trend_value", length = 32)
    private String trendValue;

    @Column(name = "trend_up")
    private Boolean trendUp = true;

    @Column(length = 64)
    private String icon;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (trendUp == null) trendUp = true;
        if (sortOrder == null) sortOrder = 0;
        if (userId == null) userId = "u-001";
    }
}