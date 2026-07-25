package com.metaplatform.gw.api.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "gw_api")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwApiEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "path", nullable = false, length = 512)
    private String path;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "method", nullable = false, length = 16)
    private String method;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "group_name", nullable = false, length = 128)
    private String groupName;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "version", nullable = false, length = 32)
    private String version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "target_service", length = 128)
    private String targetService;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 32)
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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

}
