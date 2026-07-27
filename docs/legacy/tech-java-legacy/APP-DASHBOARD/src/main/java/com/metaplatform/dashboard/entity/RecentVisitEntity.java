package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "dashboard_recent_visits")
@Data
public class RecentVisitEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String userId;
    private String resourceType;
    private String resourceId;
    private String resourceName;
    private LocalDateTime visitedAt;

    @PrePersist
    void prePersist() { if (visitedAt == null) visitedAt = LocalDateTime.now(); }
}
