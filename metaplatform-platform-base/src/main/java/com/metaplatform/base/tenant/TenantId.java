package com.metaplatform.base.tenant;

import java.util.Objects;
import java.util.UUID;

public record TenantId(UUID value) {
    public TenantId {
        Objects.requireNonNull(value, "TenantId value must not be null");
    }

    public static TenantId newId() {
        return new TenantId(UUID.randomUUID());
    }

    public static TenantId of(String s) {
        return new TenantId(UUID.fromString(s));
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
