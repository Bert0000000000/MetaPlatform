package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_deliverable_timeline")
@Data
public class DashboardPageDeliverableTimelineEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(name = "time_label", nullable = false, length = 64) private String timeLabel;
    @Column(nullable = false, length = 256) private String title;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(length = 64) private String icon;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (sortOrder == null) sortOrder = 0;
    }
}