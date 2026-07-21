package com.metaplatform.ea.process.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ea_business_process_role",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "process_id", "role_id", "relationship"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProcessRoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "process_id", nullable = false)
    private UUID processId;

    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(name = "relationship", nullable = false, length = 64)
    @Builder.Default
    private String relationship = "RESPONSIBLE";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
