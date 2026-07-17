package com.metaplatform.ont.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "ont_version")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OntologyVersionEntity {

    @Id
    @Column(name = "version_id", nullable = false, length = 64)
    private String versionId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "DRAFT";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot", nullable = false, columnDefinition = "jsonb")
    private JsonNode snapshot;

    @Column(name = "current", nullable = false)
    @Builder.Default
    private Boolean current = false;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
