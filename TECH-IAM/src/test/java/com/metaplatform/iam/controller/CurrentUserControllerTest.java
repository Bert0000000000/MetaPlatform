package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
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
}