package com.metaplatform.iam.mfa.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.mfa.dto.DisableMfaRequest;
import com.metaplatform.iam.mfa.dto.EnableMfaRequest;
import com.metaplatform.iam.mfa.dto.EnableMfaResponse;
import com.metaplatform.iam.mfa.dto.MfaStatusResponse;
import com.metaplatform.iam.mfa.dto.VerifyMfaRequest;
import com.metaplatform.iam.mfa.dto.VerifyMfaResponse;
import com.metaplatform.iam.mfa.entity.MfaConfigEntity;
import com.metaplatform.iam.mfa.repository.MfaConfigRepository;
import com.metaplatform.iam.mfa.util.TotpUtil;
import com.metaplatform.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MfaService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";

    private final MfaConfigRepository mfaConfigRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public EnableMfaResponse enable(EnableMfaRequest request) {
        UserEntity user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
        MfaConfigEntity.MfaType type = request.getMfaType() == null
                ? MfaConfigEntity.MfaType.TOTP : request.getMfaType();

        MfaConfigEntity config = mfaConfigRepository
                .findByTenantIdAndUserIdAndMfaType(user.getTenantId(), user.getId(), type)
                .orElse(null);

        String secret = TotpUtil.generateSecret();
        String backupCodesJson = TotpUtil.generateBackupCodes();

        if (config == null) {
            config = MfaConfigEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(user.getTenantId())
                    .userId(user.getId())
                    .mfaType(type)
                    .secretEncrypted(secret)
                    .phone(request.getPhone())
                    .email(request.getEmail())
                    .enabled(false)
                    .backupCodes(backupCodesJson)
                    .build();
        } else {
            config.setSecretEncrypted(secret);
            config.setPhone(request.getPhone());
            config.setEmail(request.getEmail());
            config.setBackupCodes(backupCodesJson);
            config.setEnabled(false);
        }
        MfaConfigEntity saved = mfaConfigRepository.save(config);

        String otpAuthUri = TotpUtil.buildOtpAuthUri("MetaPlatform", user.getUsername(), secret);
        return EnableMfaResponse.builder()
                .mfaConfigId(saved.getId())
                .mfaType(type.name())
                .secret(secret)
                .qrPayload(otpAuthUri)
                .otpAuthUri(otpAuthUri)
                .backupCodes(parseCodes(backupCodesJson))
                .enabled(false)
                .build();
    }

    @Transactional
    public VerifyMfaResponse verify(VerifyMfaRequest request) {
        UserEntity user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
        List<MfaConfigEntity> configs = mfaConfigRepository.findByUserId(user.getId());
        if (configs.isEmpty()) {
            throw new IamException(ErrorCode.NOT_FOUND, "用户未配置 MFA");
        }

        for (MfaConfigEntity config : configs) {
            if (request.getMfaType() != null && !request.getMfaType().equalsIgnoreCase(config.getMfaType().name())) {
                continue;
            }
            if (config.getMfaType() == MfaConfigEntity.MfaType.TOTP) {
                if (TotpUtil.verify(config.getSecretEncrypted(), request.getCode())) {
                    config.setEnabled(true);
                    mfaConfigRepository.save(config);
                    return VerifyMfaResponse.builder()
                            .verified(true)
                            .userId(user.getId())
                            .message("MFA 验证通过并已启用")
                            .build();
                }
            } else if (consumeBackupCode(config, request.getCode())) {
                config.setEnabled(true);
                mfaConfigRepository.save(config);
                return VerifyMfaResponse.builder()
                        .verified(true)
                        .userId(user.getId())
                        .message("MFA 通过备用码验证并已启用")
                        .build();
            }
        }
        return VerifyMfaResponse.builder()
                .verified(false)
                .userId(user.getId())
                .message("MFA 验证码无效")
                .build();
    }

    @Transactional
    public void disable(DisableMfaRequest request) {
        UserEntity user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
        List<MfaConfigEntity> configs = mfaConfigRepository.findByUserId(user.getId());
        if (configs.isEmpty()) {
            throw new IamException(ErrorCode.NOT_FOUND, "用户未配置 MFA");
        }

        boolean requireVerify = request.getCode() != null && !request.getCode().isBlank();
        for (MfaConfigEntity config : configs) {
            if (request.getMfaType() != null && !request.getMfaType().equalsIgnoreCase(config.getMfaType().name())) {
                continue;
            }
            if (requireVerify && !verifyCode(config, request.getCode())) {
                throw new IamException(ErrorCode.INVALID_CREDENTIALS, "MFA 验证码无效，无法关闭");
            }
            mfaConfigRepository.delete(config);
        }
    }

    @Transactional(readOnly = true)
    public MfaStatusResponse status(String userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.USER_NOT_FOUND, "用户不存在"));
        List<MfaConfigEntity> configs = mfaConfigRepository.findByUserId(userId);
        List<MfaStatusResponse.MfaTypeStatus> methods = configs.stream()
                .map(c -> MfaStatusResponse.MfaTypeStatus.builder()
                        .mfaType(c.getMfaType().name())
                        .enabled(c.getEnabled())
                        .phone(c.getPhone())
                        .email(c.getEmail())
                        .createdAt(c.getCreatedAt())
                        .build())
                .toList();
        boolean anyEnabled = configs.stream().anyMatch(c -> Boolean.TRUE.equals(c.getEnabled()));
        return MfaStatusResponse.builder()
                .userId(userId)
                .mfaEnabled(anyEnabled)
                .methods(methods)
                .build();
    }

    private boolean verifyCode(MfaConfigEntity config, String code) {
        if (config.getMfaType() == MfaConfigEntity.MfaType.TOTP) {
            return TotpUtil.verify(config.getSecretEncrypted(), code);
        }
        return consumeBackupCode(config, code);
    }

    private boolean consumeBackupCode(MfaConfigEntity config, String code) {
        List<String> codes = parseCodes(config.getBackupCodes());
        if (codes == null || codes.isEmpty() || code == null) {
            return false;
        }
        Optional<String> match = codes.stream().filter(c -> c.equals(code)).findFirst();
        if (match.isPresent()) {
            List<String> remaining = new ArrayList<>(codes);
            remaining.remove(match.get());
            try {
                config.setBackupCodes(objectMapper.writeValueAsString(remaining));
            } catch (Exception e) {
                log.warn("Failed to serialize backup codes", e);
            }
            return true;
        }
        return false;
    }

    private List<String> parseCodes(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
