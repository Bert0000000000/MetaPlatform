package com.metaplatform.gw.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "gw_api")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwApiEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "name", length = 256, nullable = false)
    private String name;

    @Column(name = "path", length = 512, nullable = false)
    private String path;

    @Column(name = "method", length = 16, nullable = false)
    private String method;

    @Column(name = "group_name", length = 128, nullable = false)
    private String groupName;

    @Column(name = "version", length = 32, nullable = false)
    private String version;

    @Column(name = "target_service", length = 128)
    private String targetService;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "status", length = 32, nullable = false)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "request_schema", columnDefinition = "jsonb")
    private Map<String, Object> requestSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "response_schema", columnDefinition = "jsonb")
    private Map<String, Object> responseSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    private Map<String, Object> parameters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "examples", columnDefinition = "jsonb")
    private Map<String, Object> examples;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
