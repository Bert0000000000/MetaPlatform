package com.metaplatform.mcp.tool.entity;

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
@Table(name = "mcp_tool")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpToolEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "server_id")
    private UUID serverId;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "input_schema", columnDefinition = "jsonb")
    private String inputSchema;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "output_schema", columnDefinition = "jsonb")
    private String outputSchema;

    @Column(name = "tool_type", nullable = false, length = 20)
    private String toolType;

    @Column(length = 2048)
    private String endpoint;

    @Column(name = "bean_class", length = 512)
    private String beanClass;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
