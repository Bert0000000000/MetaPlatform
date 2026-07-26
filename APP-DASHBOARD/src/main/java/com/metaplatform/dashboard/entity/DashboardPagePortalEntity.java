package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_portal")
@Data
public class DashboardPagePortalEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(nullable = false, length = 128) private String name;
    @Column(nullable = false, length = 16) private String kind;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(nullable = false, length = 64) private String icon;
    private Integer visits = 0;
    @Column(name = "last_visit", length = 64) private String lastVisit;
    @Column(length = 512) private String url;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (visits == null) visits = 0;
        if (sortOrder == null) sortOrder = 0;
    }
}