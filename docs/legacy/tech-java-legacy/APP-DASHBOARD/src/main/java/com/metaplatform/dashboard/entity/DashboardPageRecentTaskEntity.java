package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "dashboard_page_recent_task")
@Data
public class DashboardPageRecentTaskEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(name = "type_label", nullable = false, length = 32)
    private String typeLabel;

    @Column(name = "type_class", nullable = false, length = 64)
    private String typeClass;

    @Column(nullable = false, length = 128)
    private String agent;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "status_class", nullable = false, length = 64)
    private String statusClass;

    @Column(nullable = false, length = 64)
    private String time;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (sortOrder == null) sortOrder = 0;
        if (userId == null) userId = "u-001";
    }
}