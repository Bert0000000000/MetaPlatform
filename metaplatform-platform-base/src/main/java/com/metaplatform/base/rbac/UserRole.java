package com.metaplatform.base.rbac;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "user_roles", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "user_id", "role_id"})
})
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;

    @Column(name = "assigned_by", nullable = false)
    private UUID assignedBy;

    protected UserRole() {} // JPA

    public UserRole(UUID tenantId, UUID userId, Role role, UUID assignedBy) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        this.userId = Objects.requireNonNull(userId, "userId");
        this.role = Objects.requireNonNull(role, "role");
        this.assignedBy = Objects.requireNonNull(assignedBy, "assignedBy");
        this.assignedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getUserId() { return userId; }
    public Role getRole() { return role; }
    public Instant getAssignedAt() { return assignedAt; }
    public UUID getAssignedBy() { return assignedBy; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserRole ur)) return false;
        return Objects.equals(id, ur.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
