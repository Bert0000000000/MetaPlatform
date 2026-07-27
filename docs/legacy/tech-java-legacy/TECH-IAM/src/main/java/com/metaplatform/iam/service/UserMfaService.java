package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.mfa.ChallengeMfaRequest;
import com.metaplatform.iam.dto.mfa.ChallengeMfaResponse;
import com.metaplatform.iam.dto.mfa.MfaType;
import com.metaplatform.iam.dto.mfa.SetupMfaRequest;
import com.metaplatform.iam.dto.mfa.SetupMfaResponse;
import com.metaplatform.iam.dto.mfa.ValidateMfaRequest;
import com.metaplatform.iam.dto.mfa.ValidateMfaResponse;
import com.metaplatform.iam.dto.mfa.VerifyMfaRequest;
import com.metaplatform.iam.dto.mfa.VerifyMfaResponse;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.mfa.UserMfaEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.mfa.util.TotpUtil;
import com.metaplatform.iam.repository.UserMfaRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import com.metaplatform.iam.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserMfaService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";
    private static final List<String> DEFAULT_ROLES = Collections.singletonList("USER");

    private final UserMfaRepository userMfaRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Transactional
    public SetupMfaResponse setup(SetupMfaRequest request) {
        UserEntity user = currentUser();
        UserMfaEntity.MfaType type = toEntityType(request.getMfaType());
        UserMfaEntity entity = userMfaRepository.findByUserIdAndMfaType(user.getId(), type)
                .orElse(null);
        String secret = null;
        String otpAuthUri = null;
        String message;
        if (type == UserMfaEntity.MfaType.TOTP) {
            secret = TotpUtil.generateSecret();
            otpAuthUri = TotpUtil.buildOtpAuthUri("MetaPlatform", user.getUsername(), secret);
            message = "请使用 TOTP 应用扫描二维码或输入密钥";
        } else if (type == UserMfaEntity.MfaType.SMS) {
            message = "验证码已发送至手机（演示模式：使用 123456）";
        } else {
            message = "验证码已发送至邮箱（演示模式：使用 123456）";
        }
        if (entity == null) {
            entity = UserMfaEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(user.getTenantId())
                    .userId(user.getId())
                    .mfaType(type)
                    .secret(secret)
                    .enabled(false)
                    .verified(false)
                    .build();
        } else {
            entity.setSecret(secret);
            entity.setEnabled(false);
            entity.setVerified(false);
        }
        UserMfaEntity saved = userMfaRepository.save(entity);
        return SetupMfaResponse.builder()
                .mfaId(saved.getId())
                .mfaType(request.getMfaType())
                .secret(secret)
                .qrPayload(otpAuthUri)
                .otpAuthUri(otpAuthUri)
                .enabled(false)
                .message(message)
                .build();
    }

    @Transactional
    public VerifyMfaResponse verify(VerifyMfaRequest request) {
        UserEntity user = currentUser();
        UserMfaEntity.MfaType type = toEntityType(request.getMfaType());
        UserMfaEntity entity = userMfaRepository.findByUserIdAndMfaType(user.getId(), type)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "未配置该 MFA 类型"));
        if (verifyCode(entity, request.getCode())) {
            entity.setVerified(true);
            entity.setEnabled(true);
            userMfaRepository.save(entity);
            return VerifyMfaResponse.builder()
                    .verified(true)
                    .userId(user.getId())
                    .message("MFA 验证通过并已启用")
                    .build();
        }
        return VerifyMfaResponse.builder()
                .verified(false)
                .userId(user.getId())
                .message("验证码无效")
                .build();
    }

    @Transactional(readOnly = true)
    public ChallengeMfaResponse challenge(ChallengeMfaRequest request) {
        if (!userRepository.existsById(request.getUserId())) {
            throw new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在");
        }
        UserMfaEntity.MfaType type = toEntityType(request.getMfaType());
        Optional<UserMfaEntity> entity = userMfaRepository.findByUserIdAndMfaType(request.getUserId(), type);
        if (entity.isEmpty() || !Boolean.TRUE.equals(entity.get().getEnabled()) || !Boolean.TRUE.equals(entity.get().getVerified())) {
            return ChallengeMfaResponse.builder()
                    .userId(request.getUserId())
                    .mfaType(request.getMfaType())
                    .challenged(false)
                    .message("该 MFA 类型未启用")
                    .build();
        }
        return ChallengeMfaResponse.builder()
                .userId(request.getUserId())
                .mfaType(request.getMfaType())
                .challenged(true)
                .message("请使用已配置的 MFA 方式完成验证（演示模式：TOTP 用当前动态码，SMS/EMAIL 用 123456）")
                .build();
    }

    @Transactional
    public ValidateMfaResponse validate(ValidateMfaRequest request) {
        UserEntity user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
        UserMfaEntity.MfaType type = toEntityType(request.getMfaType());
        UserMfaEntity entity = userMfaRepository.findByUserIdAndMfaType(user.getId(), type)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "未配置该 MFA 类型"));
        if (!Boolean.TRUE.equals(entity.getEnabled()) || !Boolean.TRUE.equals(entity.getVerified())) {
            throw new IamException(ErrorCode.MFA_REQUIRED, "MFA 未启用");
        }
        if (!verifyCode(entity, request.getCode())) {
            throw new IamException(ErrorCode.INVALID_CREDENTIALS, "验证码无效");
        }
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        return ValidateMfaResponse.builder()
                .loginResult("SUCCESS")
                .userId(user.getId())
                .username(user.getUsername())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessExpirationSeconds())
                .loginAt(Instant.now())
                .build();
    }

    @Transactional(readOnly = true)
    public boolean isMfaEnabled(String userId) {
        return userMfaRepository.existsByUserIdAndEnabledTrueAndVerifiedTrue(userId);
    }

    private boolean verifyCode(UserMfaEntity entity, String code) {
        if (entity.getMfaType() == UserMfaEntity.MfaType.TOTP) {
            return TotpUtil.verify(entity.getSecret(), code);
        }
        return "123456".equals(code);
    }

    private UserMfaEntity.MfaType toEntityType(MfaType type) {
        return UserMfaEntity.MfaType.valueOf(type.name());
    }

    private UserEntity currentUser() {
        String userId = CurrentUserHolder.requireUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
    }
}
