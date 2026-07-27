package com.metaplatform.dashboard.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dashboard_deliverables")
@Data
public class DeliverableEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "deliverable_id", nullable = false, unique = true, length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String deliverableId;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(nullable = false, length = 32)
    private String type;

    @Column(name = "source_type", nullable = false, length = 32)
    private String sourceType;

    @Column(name = "source_id", length = 128)
    private String sourceId;

    @Column(name = "content_url", length = 1024)
    private String contentUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 1024)
    private String tags;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "share_token", unique = true, length = 128)
    private String shareToken;

    @Column(name = "shared_at")
    private LocalDateTime sharedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (status == null) status = "ACTIVE";
        if (type == null) type = "DOCUMENT";
        if (sourceType == null) sourceType = "MANUAL_UPLOADED";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
