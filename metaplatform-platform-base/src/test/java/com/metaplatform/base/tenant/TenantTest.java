package com.metaplatform.base.tenant;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TenantTest {

    @Test
    void shouldCreateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme Corp", "acme", true);
        assertEquals("Acme Corp", t.name());
        assertEquals("acme", t.slug());
        assertTrue(t.isActive());
    }

    @Test
    void shouldRejectNullId() {
        assertThrows(NullPointerException.class,
            () -> new Tenant(null, "name", "slug", true));
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "", "slug", true));
    }

    @Test
    void shouldRejectBlankSlug() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "name", "", true));
    }

    @Test
    void shouldRejectSlugWithSpaces() {
        assertThrows(IllegalArgumentException.class,
            () -> new Tenant(TenantId.newId(), "name", "has space", true));
    }

    @Test
    void shouldDeactivateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme", "acme", true);
        Tenant deactivated = t.deactivate();
        assertFalse(deactivated.isActive());
        assertEquals(t.id(), deactivated.id());
    }

    @Test
    void shouldActivateTenant() {
        Tenant t = new Tenant(TenantId.newId(), "Acme", "acme", false);
        Tenant activated = t.activate();
        assertTrue(activated.isActive());
    }
}
