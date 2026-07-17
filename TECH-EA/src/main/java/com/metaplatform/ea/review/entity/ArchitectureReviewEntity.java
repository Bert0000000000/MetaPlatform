package com.metaplatform.ea.review.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_architecture_review")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArchitectureReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(name = "review_type", nullable = false, length = 64)
    private String reviewType;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "target_type", length = 64)
    private String targetType;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "DRAFT";

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String decision;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "comments", columnDefinition = "jsonb")
    @Builder.Default
    private String comments = "[]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "attachments", columnDefinition = "jsonb")
    @Builder.Default
    private String attachments = "[]";

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(length = 128)
    private String reviewer;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private String metadata = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}