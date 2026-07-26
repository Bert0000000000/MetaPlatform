package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_my_app")
@Data
public class DashboardPageMyAppEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(nullable = false, length = 256) private String name;
    @Column(nullable = false, length = 32) private String type;
    @Column(name = "type_label", nullable = false, length = 32) private String typeLabel;
    @Column(columnDefinition = "TEXT") private String description;
    @Column(name = "last_used", length = 64) private String lastUsed;
    @Column(length = 32) private String date;
    @Column(length = 64) private String usage;
    @Column(length = 64) private String icon;
    private Boolean pinned = false;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (pinned == null) pinned = false;
        if (sortOrder == null) sortOrder = 0;
    }
}