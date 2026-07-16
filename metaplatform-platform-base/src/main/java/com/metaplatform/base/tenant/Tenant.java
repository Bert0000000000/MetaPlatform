package com.metaplatform.base.tenant;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "tenants")
public class Tenant {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Tenant() {} // JPA

    public Tenant(TenantId id, String name, String slug, boolean active) {
        Objects.requireNonNull(id, "id");
        this.id = id.value();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("tenant name must not be blank");
        }
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("tenant slug must not be blank");
        }
        if (slug.contains(" ")) {
            throw new IllegalArgumentException("tenant slug must not contain spaces");
        }
        this.name = name;
        this.slug = slug;
        this.active = active;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public TenantId id() { return new TenantId(id); }
    public String name() { return name; }
    public String slug() { return slug; }
    public boolean isActive() { return active; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    public Tenant deactivate() {
        return new Tenant(this.id(), this.name, this.slug, false);
    }

    public Tenant activate() {
        return new Tenant(this.id(), this.name, this.slug, true);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Tenant tenant)) return false;
        return Objects.equals(id, tenant.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
