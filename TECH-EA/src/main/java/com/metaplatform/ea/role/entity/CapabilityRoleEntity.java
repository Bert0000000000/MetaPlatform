package com.metaplatform.ea.role.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_capability_role",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "capability_id", "role_id"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CapabilityRoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "capability_id", nullable = false)
    private UUID capabilityId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(nullable = false, length = 64)
    private String relationship;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
