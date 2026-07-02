package com.metaplatform.base.rbac;

import com.metaplatform.base.tenant.TenantContext;
import com.metaplatform.base.tenant.TenantId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionEvaluatorTest {

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private RbacCacheService cacheService;

    private PermissionEvaluator evaluator;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evaluator = new PermissionEvaluator(roleRepository, userRoleRepository, cacheService);
        TenantContext.set(new TenantId(tenantId));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldReturnTrueFromCache() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("object-type", "read"))).thenReturn(true);

        assertTrue(evaluator.hasPermission(userId, "object-type", "read"));

        verifyNoInteractions(roleRepository);
    }

    @Test
    void shouldReturnFalseFromCache() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("object-type", "delete"))).thenReturn(false);

        assertFalse(evaluator.hasPermission(userId, "object-type", "delete"));

        verifyNoInteractions(roleRepository);
    }

    @Test
    void shouldFallbackToDatabaseOnCacheMiss() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("report", "export"))).thenReturn(null);

        Role role = new Role(tenantId, "exporter", "Exporter", false);
        role.addPermission(Permission.of("report", "export"));

        when(roleRepository.findRolesByUser(tenantId, userId)).thenReturn(List.of(role));

        assertTrue(evaluator.hasPermission(userId, "report", "export"));

        verify(cacheService).cachePermissions(eq(tenantId.toString()), eq(userId.toString()), any());
    }

    @Test
    void shouldReturnFalseWhenNoRoles() {
        when(cacheService.hasPermission(tenantId.toString(), userId.toString(),
                Permission.of("anything", "do"))).thenReturn(null);

        when(roleRepository.findRolesByUser(tenantId, userId)).thenReturn(List.of());

        assertFalse(evaluator.hasPermission(userId, "anything", "do"));
    }
}
