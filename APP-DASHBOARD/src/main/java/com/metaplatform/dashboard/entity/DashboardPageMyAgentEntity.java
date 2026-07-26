package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "dashboard_page_my_agent")
@Data
public class DashboardPageMyAgentEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(nullable = false, length = 128) private String name;
    @Column(nullable = false, length = 64) private String type;
    @Column(name = "type_label", length = 64) private String typeLabel;
    @Column(nullable = false, length = 32) private String status;
    @Column(name = "status_class", length = 64) private String statusClass;
    @Column(columnDefinition = "TEXT") private String description;
    private Integer tasks = 0;
    @Column(name = "success_rate") private BigDecimal successRate = BigDecimal.ZERO;
    @Column(length = 64) private String icon;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (tasks == null) tasks = 0;
        if (successRate == null) successRate = BigDecimal.ZERO;
        if (sortOrder == null) sortOrder = 0;
    }
}