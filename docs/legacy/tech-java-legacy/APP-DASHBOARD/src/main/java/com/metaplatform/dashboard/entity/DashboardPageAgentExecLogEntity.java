package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "dashboard_page_agent_exec_log")
@Data
public class DashboardPageAgentExecLogEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false, length = 64) private String userId;
    @Column(name = "log_id", nullable = false, length = 64) private String logId;
    @Column(nullable = false, length = 128) private String agent;
    @Column(name = "agent_id", length = 128) private String agentId;
    @Column(name = "exec_time", nullable = false, length = 64) private String execTime;
    @Column(nullable = false, length = 32) private String duration;
    @Column(nullable = false, length = 32) private String status;
    @Column(name = "status_class", nullable = false, length = 64) private String statusClass;
    @Column(name = "dot_class", length = 64) private String dotClass;
    @Column(nullable = false, length = 32) private String trigger;
    @Column(length = 32) private String tokens;
    @Column(name = "sort_order") private Integer sortOrder = 0;
    @PrePersist void prePersist() {
        if (userId == null) userId = "u-001";
        if (sortOrder == null) sortOrder = 0;
    }
}