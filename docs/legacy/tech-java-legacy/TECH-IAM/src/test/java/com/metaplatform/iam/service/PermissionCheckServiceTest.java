package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.permission.PermissionCheckRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckResponse;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PermissionCheckServiceTest {

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    @Mock
    private PermissionRepository permissionRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private PermissionCheckService permissionCheckService;

    @Test
    void check_shouldAllow_whenRoleHasMatchingPermission() {
        PermissionEntity perm = PermissionEntity.builder()
                .id("perm-001").permissionCode("concept:write")
                .resourceType("concept").resourceId("PERSON")
                .actions("[\"CREATE\",\"UPDATE\"]")
                .effect(PermissionEntity.Effect.ALLOW).build();

        RolePermissionEntity link = RolePermissionEntity.builder()
                .id("rp-1").roleId("role-001").permissionId("perm-001").build();

        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-001")).thenReturn(List.of(link));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(perm));

        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("CREATE");
        request.setContext(Map.of("roleIds", List.of("role-001")));

        PermissionCheckResponse response = permissionCheckService.check(request);

        assertThat(response.isAllowed()).isTrue();
        assertThat(response.getMatchedPermissions()).containsExactly("perm-001");
        assertThat(response.getReason()).contains("concept:write");
    }

    @Test
    void check_shouldDeny_whenRoleHasNoMatchingPermission() {
        PermissionEntity perm = PermissionEntity.builder()
                .id("perm-001").permissionCode("concept:read")
                .resourceType("concept").resourceId("PERSON")
                .actions("[\"READ\"]")
                .effect(PermissionEntity.Effect.ALLOW).build();

        RolePermissionEntity link = RolePermissionEntity.builder()
                .id("rp-1").roleId("role-001").permissionId("perm-001").build();

        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-001")).thenReturn(List.of(link));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(perm));

        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("DELETE");
        request.setContext(Map.of("roleIds", List.of("role-001")));

        PermissionCheckResponse response = permissionCheckService.check(request);

        assertThat(response.isAllowed()).isFalse();
        assertThat(response.getMatchedPermissions()).isEmpty();
        assertThat(response.getReason()).contains("无 DELETE 权限");
    }

    @Test
    void check_shouldAllow_whenWildcardResourceMatches() {
        // 权限定义 resourceId 为 null，表示通配 concept:* 匹配 concept:PERSON
        PermissionEntity perm = PermissionEntity.builder()
                .id("perm-002").permissionCode("concept:admin")
                .resourceType("concept").resourceId(null)
                .actions("[\"CREATE\",\"UPDATE\",\"DELETE\"]")
                .effect(PermissionEntity.Effect.ALLOW).build();

        RolePermissionEntity link = RolePermissionEntity.builder()
                .id("rp-1").roleId("role-001").permissionId("perm-002").build();

        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-001")).thenReturn(List.of(link));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(perm));

        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("CREATE");
        request.setContext(Map.of("roleIds", List.of("role-001")));

        PermissionCheckResponse response = permissionCheckService.check(request);

        assertThat(response.isAllowed()).isTrue();
        assertThat(response.getMatchedPermissions()).containsExactly("perm-002");
    }

    @Test
    void check_shouldDeny_whenDenyEffectPresentEvenWithAllow() {
        PermissionEntity allowPerm = PermissionEntity.builder()
                .id("perm-001").permissionCode("concept:write")
                .resourceType("concept").resourceId("PERSON")
                .actions("[\"CREATE\",\"UPDATE\",\"DELETE\"]")
                .effect(PermissionEntity.Effect.ALLOW).build();
        PermissionEntity denyPerm = PermissionEntity.builder()
                .id("perm-002").permissionCode("concept:delete-deny")
                .resourceType("concept").resourceId("PERSON")
                .actions("[\"DELETE\"]")
                .effect(PermissionEntity.Effect.DENY).build();

        RolePermissionEntity link1 = RolePermissionEntity.builder()
                .id("rp-1").roleId("role-001").permissionId("perm-001").build();
        RolePermissionEntity link2 = RolePermissionEntity.builder()
                .id("rp-2").roleId("role-001").permissionId("perm-002").build();

        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-001")).thenReturn(List.of(link1, link2));
        when(permissionRepository.findAllById(any())).thenReturn(List.of(allowPerm, denyPerm));

        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("DELETE");
        request.setContext(Map.of("roleIds", List.of("role-001")));

        PermissionCheckResponse response = permissionCheckService.check(request);

        assertThat(response.isAllowed()).isFalse();
        assertThat(response.getMatchedPermissions()).containsExactly("perm-002");
        assertThat(response.getReason()).contains("DENY");
    }

    @Test
    void check_shouldDeny_whenNoRoleIdsInContext() {
        PermissionCheckRequest request = new PermissionCheckRequest();
        request.setUserId("user-001");
        request.setResource("concept:PERSON");
        request.setAction("READ");
        request.setContext(Map.of("tenantId", "tenant-default"));

        PermissionCheckResponse response = permissionCheckService.check(request);

        assertThat(response.isAllowed()).isFalse();
        assertThat(response.getReason()).contains("无关联角色");
    }
}
