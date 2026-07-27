package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.permission.CreatePermissionRequest;
import com.metaplatform.iam.dto.permission.UpdatePermissionRequest;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

    @Mock
    private PermissionRepository permissionRepository;

    @Mock
    private RolePermissionRepository rolePermissionRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private PermissionService permissionService;

    @Test
    void create_shouldReturnPermissionResponse_whenCodeIsAvailable() {
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setPermissionCode("user:read");
        request.setPermissionName("查看用户");
        request.setResourceType("USER");
        request.setActions(List.of("READ"));

        when(permissionRepository.existsByTenantIdAndPermissionCodeAndDeletedFalse("tenant-default", "user:read"))
                .thenReturn(false);
        when(permissionRepository.save(any(PermissionEntity.class))).thenAnswer(i -> i.getArgument(0));

        var response = permissionService.create(request);

        assertThat(response.getPermissionCode()).isEqualTo("user:read");
        assertThat(response.getResourceType()).isEqualTo("USER");
        assertThat(response.getActions()).containsExactly("READ");
        assertThat(response.getEffect()).isEqualTo(PermissionEntity.Effect.ALLOW);
    }

    @Test
    void create_shouldThrow_whenCodeAlreadyExists() {
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setPermissionCode("user:read");
        request.setPermissionName("查看用户");
        request.setResourceType("USER");
        request.setActions(List.of("READ"));

        when(permissionRepository.existsByTenantIdAndPermissionCodeAndDeletedFalse("tenant-default", "user:read"))
                .thenReturn(true);

        assertThatThrownBy(() -> permissionService.create(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("权限编码在该租户下已存在");
    }

    @Test
    void create_shouldThrow_whenInvalidAction() {
        CreatePermissionRequest request = new CreatePermissionRequest();
        request.setPermissionCode("user:hack");
        request.setPermissionName("hack");
        request.setResourceType("USER");
        request.setActions(List.of("NUKE"));

        assertThatThrownBy(() -> permissionService.create(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("不支持的操作类型");
    }

    @Test
    void update_shouldThrowVersionConflict() {
        PermissionEntity entity = PermissionEntity.builder()
                .id("p1").tenantId("tenant-default")
                .permissionCode("user:read").permissionName("查看")
                .resourceType("USER").actions("[\"READ\"]")
                .effect(PermissionEntity.Effect.ALLOW).version(3)
                .deleted(false).build();

        when(permissionRepository.findByIdAndDeletedFalse("p1")).thenReturn(Optional.of(entity));

        UpdatePermissionRequest request = new UpdatePermissionRequest();
        request.setVersion(2);

        assertThatThrownBy(() -> permissionService.update("p1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("权限版本不匹配");
    }

    @Test
    void softDelete_shouldThrow_whenReferencedAndNotForce() {
        PermissionEntity entity = PermissionEntity.builder()
                .id("p1").tenantId("tenant-default")
                .permissionCode("user:read").permissionName("查看")
                .resourceType("USER").actions("[\"READ\"]")
                .effect(PermissionEntity.Effect.ALLOW).version(1)
                .deleted(false).build();

        when(permissionRepository.findByIdAndDeletedFalse("p1")).thenReturn(Optional.of(entity));
        when(rolePermissionRepository.countByRoleIdAndDeletedFalse("p1")).thenReturn(2L);

        assertThatThrownBy(() -> permissionService.softDelete("p1", false))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("权限已被角色引用");
    }
}