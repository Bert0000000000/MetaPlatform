package com.metaplatform.mcp.nacos.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mcp_tool_nacos_meta")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpToolNacosMetaEntity {

    @Id
    @Column(length = 64)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tool_id", nullable = false, length = 64)
    private String toolId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "tool_name", nullable = false, length = 128)
    private String toolName;

    @Column(name = "tool_version", nullable = false, length = 32)
    private String toolVersion;

    @Column(name = "server_id", length = 64)
    private String serverId;

    @Column(name = "server_type", length = 32)
    private String serverType;

    @Lob
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private String capabilities = "[]";

    @Column(name = "nacos_endpoint", length = 512)
    private String nacosEndpoint;

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;
}