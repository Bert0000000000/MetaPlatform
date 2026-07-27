package com.metaplatform.ea.process.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "ea_business_process_role")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessRoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_id", nullable = false)
    private UUID processId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "relationship", nullable = false, length = 64)
    private String relationship;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
