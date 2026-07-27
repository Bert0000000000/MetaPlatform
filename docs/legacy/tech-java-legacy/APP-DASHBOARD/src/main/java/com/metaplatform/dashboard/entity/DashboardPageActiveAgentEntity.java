package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_active_agent")
@Data
public class DashboardPageActiveAgentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "dot_class", nullable = false, length = 64)
    private String dotClass;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 64)
    private String type;

    private Integer tasks = 0;

    @Column(name = "status_bg", length = 64)
    private String statusBg;

    @Column(name = "status_color", length = 64)
    private String statusColor;

    @Column(name = "status_label", nullable = false, length = 32)
    private String statusLabel;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @PrePersist
    void prePersist() {
        if (tasks == null) tasks = 0;
        if (sortOrder == null) sortOrder = 0;
        if (userId == null) userId = "u-001";
    }
}