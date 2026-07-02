package com.metaplatform.base.rbac;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.Objects;

@Embeddable
public class Permission {

    @Column(name = "resource")
    private String resource;

    @Column(name = "action")
    private String action;

    protected Permission() {} // JPA

    public Permission(String resource, String action) {
        if (resource == null || resource.isBlank()) {
            throw new IllegalArgumentException("resource must not be blank");
        }
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("action must not be blank");
        }
        this.resource = resource;
        this.action = action;
    }

    public String resource() { return resource; }
    public String action() { return action; }

    public String toKey() {
        return resource + ":" + action;
    }

    public static Permission of(String resource, String action) {
        return new Permission(resource, action);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Permission p)) return false;
        return Objects.equals(resource, p.resource) && Objects.equals(action, p.action);
    }

    @Override
    public int hashCode() {
        return Objects.hash(resource, action);
    }

    @Override
    public String toString() {
        return toKey();
    }
}
