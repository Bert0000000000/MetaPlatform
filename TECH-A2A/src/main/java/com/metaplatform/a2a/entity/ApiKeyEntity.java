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
@Table(name = "api_key")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiKeyEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Id
    @Column(name = "key_id", nullable = false, length = 64)
    private String keyId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "agent_id", nullable = false, length = 128)
    private String agentId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "key_hash", nullable = false, length = 128)
    private String keyHash;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "permissions", nullable = false, columnDefinition = "jsonb")
    private String permissions;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "revoked", nullable = false)
    private Boolean revoked;

}
