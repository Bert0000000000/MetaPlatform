package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
import com.metaplatform.iam.dto.auth.UserPermissionsResponse;
import com.metaplatform.iam.exception.GlobalExceptionHandler;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.service.CurrentUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CurrentUserController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {com.metaplatform.iam.security.SecurityConfig.class,
                           com.metaplatform.iam.security.JwtAuthenticationFilter.class,
                           com.metaplatform.iam.common.TraceFilter.class}))
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class CurrentUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
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
    void me_shouldReturnCurrentUser_whenAuthenticated() throws Exception {
        loginAs("u1", "alice");
        CurrentUserResponse response = CurrentUserResponse.builder()
                .id("u1").username("alice").email("alice@example.com")
                .tenantId("tenant-default")
                .roles(List.of("USER"))
                .permissions(List.of())
                .departments(List.of())
                .build();
        when(currentUserService.current()).thenReturn(response);

        mockMvc.perform(get("/api/v1/iam/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("u1"))
                .andExpect(jsonPath("$.data.username").value("alice"));
    }

    @Test
    void me_shouldThrow_whenNotAuthenticated() throws Exception {
        SecurityContextHolder.clearContext();
        when(currentUserService.current()).thenAnswer(invocation -> {
            throw new IamException(ErrorCode.UNAUTHORIZED, "未登录或登录状态已失效");
        });

        mockMvc.perform(get("/api/v1/iam/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mePermissions_shouldReturnAggregatedPermissions_whenAuthenticated() throws Exception {
        loginAs("u1", "alice");
        UserPermissionsResponse response = UserPermissionsResponse.builder()
                .userId("u1")
                .tenantId("tenant-default")
                .permissionCodes(List.of("project:read", "project:write"))
                .permissions(List.of(
                        UserPermissionsResponse.PermissionDetail.builder()
                                .permissionId("perm-001")
                                .permissionCode("project:read")
                                .permissionName("项目读取")
                                .resourceType("PROJECT")
                                .actions(List.of("READ"))
                                .effect("ALLOW")
                                .build(),
                        UserPermissionsResponse.PermissionDetail.builder()
                                .permissionId("perm-002")
                                .permissionCode("project:write")
                                .permissionName("项目写入")
                                .resourceType("PROJECT")
                                .actions(List.of("CREATE", "UPDATE"))
                                .effect("ALLOW")
                                .build()))
                .roles(List.of(UserPermissionsResponse.RoleSummary.builder()
                        .roleId("role-001")
                        .roleCode("DEVELOPER")
                        .roleName("开发者")
                        .dataScope("DEPT")
                        .build()))
                .build();
        when(currentUserService.currentPermissions()).thenReturn(response);

        mockMvc.perform(get("/api/v1/iam/auth/me/permissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.userId").value("u1"))
                .andExpect(jsonPath("$.data.permissionCodes[0]").value("project:read"))
                .andExpect(jsonPath("$.data.permissions[0].permissionCode").value("project:read"))
                .andExpect(jsonPath("$.data.permissions[0].actions[0]").value("READ"))
                .andExpect(jsonPath("$.data.permissions[1].actions.length()").value(2))
                .andExpect(jsonPath("$.data.roles[0].roleCode").value("DEVELOPER"))
                .andExpect(jsonPath("$.data.roles[0].dataScope").value("DEPT"));
    }

    @Test
    void mePermissions_shouldThrow_whenNotAuthenticated() throws Exception {
        SecurityContextHolder.clearContext();
        when(currentUserService.currentPermissions()).thenAnswer(invocation -> {
            throw new IamException(ErrorCode.UNAUTHORIZED, "未登录或登录状态已失效");
        });

        mockMvc.perform(get("/api/v1/iam/auth/me/permissions"))
                .andExpect(status().isUnauthorized());
    }
}
