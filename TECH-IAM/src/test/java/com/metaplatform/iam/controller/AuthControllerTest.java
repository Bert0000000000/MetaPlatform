package com.metaplatform.iam.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.dto.AuthResponse;
import com.metaplatform.iam.dto.LoginRequest;
import com.metaplatform.iam.dto.RegisterRequest;
import com.metaplatform.iam.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private com.metaplatform.iam.util.JwtUtil jwtUtil;

    @Test
    void register_shouldReturn200_whenRequestIsValid() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("password123");

        AuthResponse response = AuthResponse.builder()
                .accessToken("token")
                .tokenType("Bearer")
                .expiresIn(7200L)
                .user(AuthResponse.UserInfo.builder()
                        .id("user-9a8b7c6d")
                        .username("alice")
                        .email("alice@example.com")
                        .status("ENABLED")
                        .build())
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.accessToken").value("token"));
    }

    @Test
    void login_shouldReturn200_whenCredentialsAreValid() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("password123");

        AuthResponse response = AuthResponse.builder()
                .accessToken("token")
                .tokenType("Bearer")
                .expiresIn(7200L)
                .refreshToken("refresh-token")
                .refreshExpiresIn(604800L)
                .loginResult("SUCCESS")
                .user(AuthResponse.UserInfo.builder()
                        .id("user-9a8b7c6d")
                        .username("alice")
                        .build())
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/iam/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.loginResult").value("SUCCESS"))
                .andExpect(jsonPath("$.data.user.username").value("alice"));
    }
}
