package com.metaplatform.iam.service;

import com.metaplatform.iam.dto.role.AssignRolePermissionsRequest;
import com.metaplatform.iam.dto.role.AssignRolePermissionsResponse;
import com.metaplatform.iam.dto.role.CreateRoleRequest;
import com.metaplatform.iam.dto.role.RoleResponse;
import com.metaplatform.iam.dto.role.UpdateRoleRequest;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RoleEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import com.metaplatform.iam.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    @Mock
    private PermissionRepository permissionRepository;

    @InjectMocks
    private RoleService roleService;

    @Test
    void create_shouldReturnRoleResponse_whenCodeIsAvailable() {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setRoleCode("PM");
        request.setRoleName("项目经理");
        request.setDescription("管理项目");

        when(roleRepository.existsByTenantIdAndRoleCodeAndDeletedFalse("tenant-default", "PM")).thenReturn(false);
        when(roleRepository.save(any(RoleEntity.class))).thenAnswer(i -> i.getArgument(0));

        RoleResponse response = roleService.create(request);

        assertThat(response.getRoleCode()).isEqualTo("PM");
        assertThat(response.getRoleName()).isEqualTo("项目经理");
        assertThat(response.getRoleType()).isEqualTo(RoleEntity.RoleType.CUSTOM);
        assertThat(response.getDataScope()).isEqualTo(RoleEntity.DataScope.SELF);
        assertThat(response.getEnabled()).isTrue();
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreateRoleRequest request = new CreateRoleRequest();
        request.setRoleCode("PM");
        request.setRoleName("项目经理");

        when(roleRepository.existsByTenantIdAndRoleCodeAndDeletedFalse("tenant-default", "PM")).thenReturn(true);

        assertThatThrownBy(() -> roleService.create(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("角色编码在该租户下已存在");
    }

    @Test
    void softDelete_shouldThrow_whenRoleIsSystem() {
        RoleEntity role = RoleEntity.builder()
                .id("r1").roleCode("ADMIN").roleName("管理员")
                .roleType(RoleEntity.RoleType.SYSTEM)
                .dataScope(RoleEntity.DataScope.ALL)
                .enabled(true).version(1).tenantId("tenant-default")
                .deleted(false).build();

        when(roleRepository.findByIdAndDeletedFalse("r1")).thenReturn(Optional.of(role));

        assertThatThrownBy(() -> roleService.softDelete("r1"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("系统内置角色不可删除");
    }

    @Test
    void assignPermissions_shouldThrow_whenRoleIsSystem() {
        RoleEntity role = RoleEntity.builder()
                .id("r1").roleCode("ADMIN").roleName("管理员")
                .roleType(RoleEntity.RoleType.SYSTEM)
                .dataScope(RoleEntity.DataScope.ALL)
                .enabled(true).version(1).tenantId("tenant-default")
                .deleted(false).build();

        when(roleRepository.findByIdAndDeletedFalse("r1")).thenReturn(Optional.of(role));

        AssignRolePermissionsRequest request = new AssignRolePermissionsRequest();
        request.setPermissionIds(List.of("perm-1"));

        assertThatThrownBy(() -> roleService.assignPermissions("r1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("系统内置角色不可修改权限");
    }

    @Test
    void assignPermissions_shouldThrow_whenPermissionIdsInvalid() {
        RoleEntity role = RoleEntity.builder()
                .id("r1").roleCode("PM").roleName("项目经理")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.SELF)
                .enabled(true).version(1).tenantId("tenant-default")
                .deleted(false).build();

        when(roleRepository.findByIdAndDeletedFalse("r1")).thenReturn(Optional.of(role));
        when(permissionRepository.findAllById(List.of("perm-1", "perm-2"))).thenReturn(List.of(
                PermissionEntity.builder().id("perm-1").tenantId("tenant-default")
                        .permissionCode("p:r").permissionName("x").resourceType("P")
                        .actions("[\"READ\"]").effect(PermissionEntity.Effect.ALLOW).version(1)
                        .deleted(false).build()));

        AssignRolePermissionsRequest request = new AssignRolePermissionsRequest();
        request.setPermissionIds(List.of("perm-1", "perm-2"));
        request.setReplaceMode(true);

        assertThatThrownBy(() -> roleService.assignPermissions("r1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("部分 permissionId 不存在");
    }

    @Test
    void assignPermissions_shouldReturnAssignedList_whenValid() {
        RoleEntity role = RoleEntity.builder()
                .id("r1").roleCode("PM").roleName("项目经理")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.SELF)
                .enabled(true).version(1).tenantId("tenant-default")
                .deleted(false).build();

        PermissionEntity perm = PermissionEntity.builder()
                .id("perm-1").tenantId("tenant-default")
                .permissionCode("p:r").permissionName("x").resourceType("P")
                .actions("[\"READ\"]").effect(PermissionEntity.Effect.ALLOW).version(1)
                .deleted(false).build();

        when(roleRepository.findByIdAndDeletedFalse("r1")).thenReturn(Optional.of(role));
        when(permissionRepository.findAllById(List.of("perm-1"))).thenReturn(List.of(perm));
        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("r1")).thenReturn(List.of());
        when(rolePermissionRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));
        when(roleRepository.save(any(RoleEntity.class))).thenAnswer(i -> i.getArgument(0));

        AssignRolePermissionsRequest request = new AssignRolePermissionsRequest();
        request.setPermissionIds(List.of("perm-1"));
        request.setReplaceMode(true);

        AssignRolePermissionsResponse response = roleService.assignPermissions("r1", request);

        assertThat(response.getRoleId()).isEqualTo("r1");
        assertThat(response.getRoleCode()).isEqualTo("PM");
        assertThat(response.getPermissionCount()).isEqualTo(1);
        assertThat(response.getAssignedPermissions()).hasSize(1);
    }

    @Test
    void update_shouldThrowVersionConflict() {
        RoleEntity role = RoleEntity.builder()
                .id("r1").roleCode("PM").roleName("项目经理")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.SELF)
                .enabled(true).version(2).tenantId("tenant-default")
                .deleted(false).build();

        when(roleRepository.findByIdAndDeletedFalse("r1")).thenReturn(Optional.of(role));

        UpdateRoleRequest request = new UpdateRoleRequest();
        request.setVersion(1);

        assertThatThrownBy(() -> roleService.update("r1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("角色版本不匹配");
    }
}