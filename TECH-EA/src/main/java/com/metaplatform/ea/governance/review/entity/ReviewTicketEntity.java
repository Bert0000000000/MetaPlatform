package com.metaplatform.ea.governance.review.entity;

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
@Table(name = "ea_review_ticket")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewTicketEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(name = "template_id")
    private UUID templateId;

    @Column(name = "target_type", length = 64)
    private String targetType;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(length = 128)
    private String applicant;

    @Column(length = 128)
    private String reviewer;

    @Column(nullable = false, length = 32)
    @Builder.Default
    private String status = "CREATED";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "scores", columnDefinition = "jsonb")
    @Builder.Default
    private String scores = "[]";

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "comments", columnDefinition = "jsonb")
    @Builder.Default
    private String comments = "[]";

    @Column(columnDefinition = "TEXT")
    private String decision;

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
