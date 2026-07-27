package com.metaplatform.mcp.ratelimit.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "mcp_rate_limit")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class McpRateLimitEntity {

    @Id
    @Column(length = 128)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "tool_id", nullable = false, length = 64)
    private String toolId;

    @Column(name = "window_start", nullable = false)
    private OffsetDateTime windowStart;

    @Column(name = "call_count", nullable = false)
    @Builder.Default
    private Integer callCount = 0;

    @Column(name = "rejected_count", nullable = false)
    @Builder.Default
    private Integer rejectedCount = 0;
}