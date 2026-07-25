package com.metaplatform.data.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "deliverable")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliverableEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "type", nullable = false, length = 32)
    private String type;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "title", nullable = false, length = 256)
    private String title;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "source", nullable = false, length = 128)
    private String source;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 1024)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "format", nullable = false, length = 16)
    private String format;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "size", nullable = false)
    private Integer size;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "download_url", length = 512)
    private String downloadUrl;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "object_key", length = 512)
    private String objectKey;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "bucket", length = 128)
    private String bucket;

}
