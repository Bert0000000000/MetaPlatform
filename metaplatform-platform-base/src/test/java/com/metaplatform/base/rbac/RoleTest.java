package com.metaplatform.base.rbac;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class RoleTest {

    @Test
    void shouldCreateRole() {
        Role r = new Role(UUID.randomUUID(), "admin", "Administrator", true);
        assertEquals("admin", r.getName());
        assertTrue(r.isSystemRole());
        assertTrue(r.getPermissions().isEmpty());
    }

    @Test
    void shouldAddPermission() {
        Role r = new Role(UUID.randomUUID(), "editor", "Editor", false);
        r.addPermission(Permission.of("object-type", "read"));
        r.addPermission(Permission.of("object-type", "write"));
        assertEquals(2, r.getPermissions().size());
    }

    @Test
    void shouldCheckPermission() {
        Role r = new Role(UUID.randomUUID(), "viewer", "Viewer", false);
        r.addPermission(Permission.of("object-instance", "read"));
        assertTrue(r.hasPermission(Permission.of("object-instance", "read")));
        assertFalse(r.hasPermission(Permission.of("object-instance", "delete")));
    }

    @Test
    void shouldRemovePermission() {
        Role r = new Role(UUID.randomUUID(), "temp", "Temp", false);
        Permission p = Permission.of("report", "export");
        r.addPermission(p);
        assertTrue(r.hasPermission(p));
        r.removePermission(p);
        assertFalse(r.hasPermission(p));
    }

    @Test
    void shouldRejectBlankName() {
        assertThrows(IllegalArgumentException.class,
            () -> new Role(UUID.randomUUID(), "", "desc", false));
    }

    @Test
    void shouldRejectNullTenantId() {
        assertThrows(NullPointerException.class,
            () -> new Role(null, "role", "desc", false));
    }
}
