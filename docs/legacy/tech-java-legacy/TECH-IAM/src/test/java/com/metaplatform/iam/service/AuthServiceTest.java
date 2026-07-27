package com.metaplatform.iam.service;

import com.metaplatform.iam.dto.AuthResponse;
import com.metaplatform.iam.dto.LoginRequest;
import com.metaplatform.iam.dto.RegisterRequest;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.audit.service.AuditLogService;
import com.metaplatform.iam.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private IamOutboxService iamOutboxService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AuthService authService;

    @Test
    void register_shouldReturnToken_whenUsernameAndEmailAreAvailable() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("P@ssw0rd");

        UserEntity saved = UserEntity.builder()
                .id("user-9a8b7c6d")
                .tenantId("tenant-default")
                .username("alice")
                .email("alice@example.com")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();

        when(userRepository.existsByTenantIdAndUsername("tenant-default", "alice")).thenReturn(false);
        when(userRepository.existsByTenantIdAndEmail("tenant-default", "alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("P@ssw0rd")).thenReturn("encoded");
        when(userRepository.save(any(UserEntity.class))).thenReturn(saved);
        when(jwtUtil.generateAccessToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("refresh-token");
        when(jwtUtil.getAccessExpirationSeconds()).thenReturn(7200L);
        when(jwtUtil.getRefreshExpirationSeconds()).thenReturn(604800L);

        AuthResponse response = authService.register(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getUser().getUsername()).isEqualTo("alice");
        assertThat(response.getRequirePasswordReset()).isTrue();
        verify(userRepository).save(any(UserEntity.class));
    }

    @Test
    void register_shouldThrow_whenUsernameExists() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("P@ssw0rd");

        when(userRepository.existsByTenantIdAndUsername("tenant-default", "alice")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("用户名在该租户下已存在");
    }

    @Test
    void register_shouldThrow_whenPasswordTooWeak() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("12345678");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("密码必须包含");
    }

    @Test
    void register_shouldAllowSameUsernameInDifferentTenants() {
        // tenant-acme 中创建用户 alice
        RegisterRequest reqAcme = new RegisterRequest();
        reqAcme.setUsername("alice");
        reqAcme.setEmail("alice@acme.example.com");
        reqAcme.setPassword("P@ssw0rd");
        reqAcme.setTenantId("tenant-acme");

        UserEntity aliceAcme = UserEntity.builder()
                .id("user-acme")
                .tenantId("tenant-acme")
                .username("alice")
                .email("alice@acme.example.com")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();

        when(userRepository.existsByTenantIdAndUsername("tenant-acme", "alice")).thenReturn(false);
        when(userRepository.existsByTenantIdAndEmail("tenant-acme", "alice@acme.example.com")).thenReturn(false);
        when(passwordEncoder.encode("P@ssw0rd")).thenReturn("encoded");
        when(userRepository.save(any(UserEntity.class))).thenReturn(aliceAcme);
        when(jwtUtil.generateAccessToken(eq("user-acme"), eq("alice"), eq("tenant-acme"), eq(Collections.singletonList("USER"))))
                .thenReturn("acme-access");
        when(jwtUtil.generateRefreshToken(eq("user-acme"), eq("alice"), eq("tenant-acme"), eq(Collections.singletonList("USER"))))
                .thenReturn("acme-refresh");
        when(jwtUtil.getAccessExpirationSeconds()).thenReturn(7200L);
        when(jwtUtil.getRefreshExpirationSeconds()).thenReturn(604800L);

        AuthResponse response = authService.register(reqAcme);

        assertThat(response.getAccessToken()).isEqualTo("acme-access");
        assertThat(response.getUserId()).isEqualTo("user-acme");
    }

    @Test
    void login_shouldThrow_whenTenantMismatch() {
        // 登录时指定 tenant-acme，但 alice 只在 tenant-default 中存在
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("P@ssw0rd");
        request.setTenantId("tenant-acme");

        when(userRepository.findByTenantIdAndUsername("tenant-acme", "alice")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("用户名或密码错误");
    }

    @Test
    void login_shouldReturnToken_whenCredentialsAreValid() {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("P@ssw0rd");

        UserEntity user = UserEntity.builder()
                .id("user-9a8b7c6d")
                .tenantId("tenant-default")
                .username("alice")
                .email("alice@example.com")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(false)
                .build();

        when(userRepository.findByTenantIdAndUsername("tenant-default", "alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("P@ssw0rd", "encoded")).thenReturn(true);
        when(jwtUtil.generateAccessToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("refresh-token");
        when(jwtUtil.getAccessExpirationSeconds()).thenReturn(7200L);
        when(jwtUtil.getRefreshExpirationSeconds()).thenReturn(604800L);
        when(userRepository.save(any(UserEntity.class))).thenReturn(user);

        AuthResponse response = authService.login(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getLoginResult()).isEqualTo("SUCCESS");
        assertThat(response.getMfaRequired()).isFalse();
        verify(userRepository).save(user);
    }

    @Test
    void login_shouldThrow_whenPasswordIsInvalid() {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("wrong");

        UserEntity user = UserEntity.builder()
                .id("user-9a8b7c6d")
                .username("alice")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .build();

        when(userRepository.findByTenantIdAndUsername("tenant-default", "alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("用户名或密码错误");
    }

    // -------------------------------------------------- S-IAM-05 outbox tests

    @Test
    void register_shouldPublishOutboxEvent_whenRegistrationSucceeds() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setEmail("alice@example.com");
        request.setPassword("P@ssw0rd");

        UserEntity saved = UserEntity.builder()
                .id("user-9a8b7c6d")
                .tenantId("tenant-default")
                .username("alice")
                .email("alice@example.com")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();

        when(userRepository.existsByTenantIdAndUsername("tenant-default", "alice")).thenReturn(false);
        when(userRepository.existsByTenantIdAndEmail("tenant-default", "alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("P@ssw0rd")).thenReturn("encoded");
        when(userRepository.save(any(UserEntity.class))).thenReturn(saved);
        when(jwtUtil.generateAccessToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("refresh-token");
        when(jwtUtil.getAccessExpirationSeconds()).thenReturn(7200L);
        when(jwtUtil.getRefreshExpirationSeconds()).thenReturn(604800L);

        authService.register(request);

        // 验证 outbox 表写入了 USER_REGISTERED 记录
        verify(iamOutboxService).publishEvent(
                eq("tenant-default"),
                eq("User"),
                eq("user-9a8b7c6d"),
                eq("USER_REGISTERED"),
                argThat((Map<String, Object> payload) ->
                        "user-9a8b7c6d".equals(payload.get("userId"))
                                && "alice".equals(payload.get("username"))
                                && "tenant-default".equals(payload.get("tenantId"))),
                argThat((Map<String, String> headers) ->
                        headers != null && headers.containsKey("X-Trace-Id"))
        );
    }

    @Test
    void login_shouldPublishOutboxEvent_whenLoginSucceeds() {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("P@ssw0rd");

        UserEntity user = UserEntity.builder()
                .id("user-9a8b7c6d")
                .tenantId("tenant-default")
                .username("alice")
                .email("alice@example.com")
                .passwordHash("encoded")
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(false)
                .build();

        when(userRepository.findByTenantIdAndUsername("tenant-default", "alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("P@ssw0rd", "encoded")).thenReturn(true);
        when(jwtUtil.generateAccessToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("user-9a8b7c6d"), eq("alice"), eq("tenant-default"), eq(Collections.singletonList("USER"))))
                .thenReturn("refresh-token");
        when(jwtUtil.getAccessExpirationSeconds()).thenReturn(7200L);
        when(jwtUtil.getRefreshExpirationSeconds()).thenReturn(604800L);
        when(userRepository.save(any(UserEntity.class))).thenReturn(user);

        authService.login(request);

        // 验证 outbox 表写入了 USER_LOGIN 记录
        verify(iamOutboxService).publishEvent(
                eq("tenant-default"),
                eq("User"),
                eq("user-9a8b7c6d"),
                eq("USER_LOGIN"),
                argThat((Map<String, Object> payload) ->
                        "user-9a8b7c6d".equals(payload.get("userId"))
                                && "alice".equals(payload.get("username"))
                                && "tenant-default".equals(payload.get("tenantId"))),
                argThat((Map<String, String> headers) ->
                        headers != null && headers.containsKey("X-Trace-Id"))
        );
    }
}
