package com.metaplatform.base.rbac;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(name = "system_role", nullable = false)
    private boolean systemRole; // 系统预置角色不可删除

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    private Set<Permission> permissions = new HashSet<>();

    protected Role() {} // JPA

    public Role(UUID tenantId, String name, String description, boolean systemRole) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("role name must not be blank");
        }
        this.name = name;
        this.description = description;
        this.systemRole = systemRole;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public boolean isSystemRole() { return systemRole; }
    public Set<Permission> getPermissions() { return Collections.unmodifiableSet(permissions); }

    public void addPermission(Permission permission) {
        permissions.add(permission);
    }

    public void removePermission(Permission permission) {
        permissions.remove(permission);
    }

    public boolean hasPermission(Permission permission) {
        return permissions.contains(permission);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Role role)) return false;
        return Objects.equals(id, role.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
