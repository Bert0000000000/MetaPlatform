package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.auth.UserPermissionsResponse;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RoleEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.UserRoleEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import com.metaplatform.iam.repository.RoleRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.repository.UserRoleRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CurrentUserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserDepartmentService userDepartmentService;
    @Mock
    private UserRoleRepository userRoleRepository;
    @Mock
    private RolePermissionRepository rolePermissionRepository;
    @Mock
    private PermissionRepository permissionRepository;
    @Mock
    private RoleRepository roleRepository;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private CurrentUserService currentUserService;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String userId, String username) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                org.springframework.security.core.userdetails.User.builder()
                        .username(username).password("").authorities(List.of(new SimpleGrantedAuthority("USER"))).build(),
                userId,
                List.of(new SimpleGrantedAuthority("USER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void currentPermissions_shouldAggregateRolesAndPermissions() {
        loginAs("user-001", "alice");
        UserEntity user = UserEntity.builder()
                .id("user-001").tenantId("tenant-default")
                .username("alice").email("alice@example.com")
                .passwordHash("x").build();
        when(userRepository.findById("user-001")).thenReturn(Optional.of(user));

        UserRoleEntity userRole = UserRoleEntity.builder()
                .id("ur-1").userId("user-001").roleId("role-001").version(1).build();
        when(userRoleRepository.findByUserIdAndDeletedFalse("user-001")).thenReturn(List.of(userRole));

        RoleEntity role = RoleEntity.builder()
                .id("role-001").tenantId("tenant-default")
                .roleCode("DEVELOPER").roleName("开发者")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.DEPT)
                .enabled(true).version(1).build();
        when(roleRepository.findAllById(any())).thenReturn(List.of(role));

        RolePermissionEntity link = RolePermissionEntity.builder()
                .id("rp-1").roleId("role-001").permissionId("perm-001").version(1).build();
        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-001")).thenReturn(List.of(link));

        PermissionEntity perm = PermissionEntity.builder()
                .id("perm-001").tenantId("tenant-default")
                .permissionCode("project:read").permissionName("项目读取")
                .resourceType("PROJECT").actions("[\"READ\"]")
                .effect(PermissionEntity.Effect.ALLOW).version(1).build();
        when(permissionRepository.findAllById(any())).thenReturn(List.of(perm));

        UserPermissionsResponse response = currentUserService.currentPermissions();

        assertThat(response.getUserId()).isEqualTo("user-001");
        assertThat(response.getTenantId()).isEqualTo("tenant-default");
        assertThat(response.getPermissionCodes()).containsExactly("project:read");
        assertThat(response.getPermissions()).hasSize(1);
        UserPermissionsResponse.PermissionDetail detail = response.getPermissions().get(0);
        assertThat(detail.getPermissionCode()).isEqualTo("project:read");
        assertThat(detail.getResourceType()).isEqualTo("PROJECT");
        assertThat(detail.getActions()).containsExactly("READ");
        assertThat(detail.getEffect()).isEqualTo("ALLOW");
        assertThat(response.getRoles()).hasSize(1);
        assertThat(response.getRoles().get(0).getRoleCode()).isEqualTo("DEVELOPER");
        assertThat(response.getRoles().get(0).getDataScope()).isEqualTo("DEPT");
    }

    @Test
    void currentPermissions_shouldReturnEmpty_whenUserHasNoRoles() {
        loginAs("user-002", "bob");
        UserEntity user = UserEntity.builder()
                .id("user-002").tenantId("tenant-default")
                .username("bob").email("bob@example.com")
                .passwordHash("x").build();
        when(userRepository.findById("user-002")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserIdAndDeletedFalse("user-002")).thenReturn(List.of());

        UserPermissionsResponse response = currentUserService.currentPermissions();

        assertThat(response.getUserId()).isEqualTo("user-002");
        assertThat(response.getPermissionCodes()).isEmpty();
        assertThat(response.getPermissions()).isEmpty();
        assertThat(response.getRoles()).isEmpty();
    }

    @Test
    void currentPermissions_shouldReturnEmptyPermissions_whenRolesHaveNoPermissionsBound() {
        loginAs("user-003", "carol");
        UserEntity user = UserEntity.builder()
                .id("user-003").tenantId("tenant-default")
                .username("carol").email("carol@example.com")
                .passwordHash("x").build();
        when(userRepository.findById("user-003")).thenReturn(Optional.of(user));

        UserRoleEntity userRole = UserRoleEntity.builder()
                .id("ur-2").userId("user-003").roleId("role-002").version(1).build();
        when(userRoleRepository.findByUserIdAndDeletedFalse("user-003")).thenReturn(List.of(userRole));

        RoleEntity role = RoleEntity.builder()
                .id("role-002").tenantId("tenant-default")
                .roleCode("VIEWER").roleName("访客")
                .roleType(RoleEntity.RoleType.CUSTOM)
                .dataScope(RoleEntity.DataScope.SELF)
                .enabled(true).version(1).build();
        when(roleRepository.findAllById(any())).thenReturn(List.of(role));
        when(rolePermissionRepository.findByRoleIdAndDeletedFalse("role-002")).thenReturn(List.of());

        UserPermissionsResponse response = currentUserService.currentPermissions();

        assertThat(response.getPermissions()).isEmpty();
        assertThat(response.getPermissionCodes()).isEmpty();
        assertThat(response.getRoles()).hasSize(1);
        assertThat(response.getRoles().get(0).getRoleCode()).isEqualTo("VIEWER");
    }

    @Test
    void currentPermissions_shouldThrow_whenNotAuthenticated() {
        SecurityContextHolder.clearContext();
        assertThatThrownBy(() -> currentUserService.currentPermissions())
                .isInstanceOf(IamException.class)
                .satisfies(ex -> assertThat(((IamException) ex).getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void currentPermissions_shouldThrow_whenUserNotFound() {
        loginAs("missing", "ghost");
        when(userRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> currentUserService.currentPermissions())
                .isInstanceOf(IamException.class)
                .satisfies(ex -> assertThat(((IamException) ex).getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }
}
