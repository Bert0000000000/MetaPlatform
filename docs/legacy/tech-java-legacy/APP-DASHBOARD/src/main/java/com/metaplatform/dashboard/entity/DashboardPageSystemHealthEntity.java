package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_system_health")
@Data
public class DashboardPageSystemHealthEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "dot_class", nullable = false, length = 64)
    private String dotClass;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 256)
    private String detail;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @PrePersist
    void prePersist() {
        if (sortOrder == null) sortOrder = 0;
        if (userId == null) userId = "u-001";
    }
}