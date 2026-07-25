package com.metaplatform.a2a.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "agent_card")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentCardEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "description", length = 2048)
    private String description;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "version", nullable = false, length = 32)
    private String version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "protocol_version", nullable = false, length = 16)
    private String protocolVersion;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "capabilities", nullable = false, columnDefinition = "jsonb")
    private String capabilities;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "endpoints", nullable = false, columnDefinition = "jsonb")
    private String endpoints;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "authentication", nullable = false, columnDefinition = "jsonb")
    private String authentication;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

}
