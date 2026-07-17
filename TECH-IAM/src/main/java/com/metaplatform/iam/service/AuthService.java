package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.TraceContext;
import com.metaplatform.iam.audit.entity.IamAuditLogEntity;
import com.metaplatform.iam.audit.service.AuditLogService;
import com.metaplatform.iam.dto.AuthResponse;
import com.metaplatform.iam.dto.LoginRequest;
import com.metaplatform.iam.dto.RegisterRequest;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";
    private static final List<String> DEFAULT_ROLES = Collections.singletonList("USER");
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final IamOutboxService iamOutboxService;
    private final AuditLogService auditLogService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        validatePassword(request.getPassword());
        String tenantId = resolveTenantId(request.getTenantId());
        if (userRepository.existsByTenantIdAndUsername(tenantId, request.getUsername())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "用户名在该租户下已存在");
        }
        if (userRepository.existsByTenantIdAndEmail(tenantId, request.getEmail())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "邮箱在该租户下已存在");
        }

        UserEntity user = UserEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .realName(request.getRealName())
                .phone(request.getPhone())
                .status(UserEntity.UserStatus.ENABLED)
                .requirePasswordReset(true)
                .build();

        UserEntity saved = userRepository.save(user);

        publishOutboxEvent(saved, "USER_REGISTERED");
        auditLogService.record(saved.getTenantId(), saved.getId(), IamAuditLogEntity.Action.CREATE,
                "User", saved.getId(), "用户注册: " + saved.getUsername(),
                IamAuditLogEntity.Status.SUCCESS, null);

        String accessToken = jwtUtil.generateAccessToken(saved.getId(), saved.getUsername(), saved.getTenantId(), DEFAULT_ROLES);
        String refreshToken = jwtUtil.generateRefreshToken(saved.getId(), saved.getUsername(), saved.getTenantId(), DEFAULT_ROLES);
        return buildAuthResponse(saved, accessToken, refreshToken, "SUCCESS", null);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        UserEntity user = userRepository.findByTenantIdAndUsername(tenantId, request.getUsername())
                .orElseThrow(() -> new IamException(ErrorCode.INVALID_CREDENTIALS));

        if (user.getStatus() == UserEntity.UserStatus.DISABLED) {
            auditLogService.record(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.LOGIN,
                    "User", user.getId(), "登录失败：账户已禁用",
                    IamAuditLogEntity.Status.FAILED, null);
            throw new IamException(ErrorCode.ACCOUNT_DISABLED, "账户已被禁用");
        }
        if (user.getStatus() == UserEntity.UserStatus.LOCKED) {
            auditLogService.record(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.LOGIN,
                    "User", user.getId(), "登录失败：账户已锁定",
                    IamAuditLogEntity.Status.FAILED, null);
            throw new IamException(ErrorCode.ACCOUNT_LOCKED, "账户已被锁定");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            auditLogService.record(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.LOGIN,
                    "User", user.getId(), "登录失败：密码错误",
                    IamAuditLogEntity.Status.FAILED, null);
            throw new IamException(ErrorCode.INVALID_CREDENTIALS);
        }

        Instant now = Instant.now();
        user.setLastLoginAt(now);
        userRepository.save(user);

        publishOutboxEvent(user, "USER_LOGIN");
        auditLogService.record(user.getTenantId(), user.getId(), IamAuditLogEntity.Action.LOGIN,
                "User", user.getId(), "用户登录成功: " + user.getUsername(),
                IamAuditLogEntity.Status.SUCCESS, null);

        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        return buildAuthResponse(user, accessToken, refreshToken, "SUCCESS", now);
    }

    private String resolveTenantId(String requestTenantId) {
        if (requestTenantId != null && !requestTenantId.isBlank()) {
            return requestTenantId;
        }
        return DEFAULT_TENANT_ID;
    }

    /**
     * 将用户事件写入 outbox 表（S-IAM-05）。
     *
     * @param user      触发事件的用户实体
     * @param eventType 事件类型（USER_REGISTERED / USER_LOGIN）
     */
    private void publishOutboxEvent(UserEntity user, String eventType) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", user.getId());
        payload.put("username", user.getUsername());
        payload.put("tenantId", user.getTenantId());

        Map<String, String> headers = new HashMap<>();
        headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());

        iamOutboxService.publishEvent(
                user.getTenantId(),
                "User",
                user.getId(),
                eventType,
                payload,
                headers
        );
    }

    private AuthResponse buildAuthResponse(UserEntity user, String accessToken, String refreshToken, String loginResult, Instant loginAt) {
        return AuthResponse.builder()
                .loginResult(loginResult)
                .userId(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessExpirationSeconds())
                .refreshExpiresIn(jwtUtil.getRefreshExpirationSeconds())
                .requirePasswordReset(user.getRequirePasswordReset())
                .mfaRequired(false)
                .loginAt(loginAt != null ? ISO_FORMATTER.format(loginAt.atZone(ZoneId.systemDefault())) : null)
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .realName(user.getRealName())
                        .status(user.getStatus().name())
                        .build())
                .build();
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "密码长度必须在 8-64 位之间");
        }
        int categoryCount = 0;
        if (Pattern.compile("[A-Z]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[a-z]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[0-9]").matcher(password).find()) categoryCount++;
        if (Pattern.compile("[^A-Za-z0-9]").matcher(password).find()) categoryCount++;
        if (categoryCount < 3) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "密码必须包含大写字母、小写字母、数字、特殊字符中的至少 3 类");
        }
    }
}
