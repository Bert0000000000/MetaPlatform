package com.metaplatform.iam.sso.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.mfa.repository.MfaConfigRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import com.metaplatform.iam.sso.dto.AuthorizeUrlResponse;
import com.metaplatform.iam.sso.dto.CreateSsoConfigRequest;
import com.metaplatform.iam.sso.dto.SamlAssertionRequest;
import com.metaplatform.iam.sso.dto.SsoCallbackRequest;
import com.metaplatform.iam.sso.dto.SsoConfigResponse;
import com.metaplatform.iam.sso.dto.SsoLoginResponse;
import com.metaplatform.iam.sso.dto.UpdateSsoConfigRequest;
import com.metaplatform.iam.sso.entity.SsoConfigEntity;
import com.metaplatform.iam.sso.repository.SsoConfigRepository;
import com.metaplatform.iam.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SsoService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";
    private static final List<String> DEFAULT_ROLES = Collections.singletonList("USER");

    private final SsoConfigRepository ssoConfigRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final MfaConfigRepository mfaConfigRepository;

    @Transactional
    public SsoConfigResponse create(CreateSsoConfigRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        if (ssoConfigRepository.existsByTenantIdAndProviderNameAndDeletedFalse(tenantId, request.getProviderName())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "SSO 配置名称在该租户下已存在");
        }
        String operator = currentOperator();
        SsoConfigEntity entity = SsoConfigEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .providerName(request.getProviderName())
                .providerType(request.getProviderType() == null ? SsoConfigEntity.ProviderType.OAUTH2 : request.getProviderType())
                .clientId(request.getClientId())
                .clientSecretEncrypted(encryptSecret(request.getClientSecret()))
                .redirectUri(request.getRedirectUri())
                .scopes(request.getScopes())
                .config(request.getConfig())
                .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        SsoConfigEntity saved = ssoConfigRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<SsoConfigResponse> list(String tenantId, String keyword, Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "providerName"));
        Page<SsoConfigEntity> result;
        if (keyword != null && !keyword.isBlank()) {
            result = ssoConfigRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = ssoConfigRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }
        List<SsoConfigResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<SsoConfigResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public SsoConfigResponse get(String id) {
        return toResponse(findActive(id));
    }

    @Transactional
    public SsoConfigResponse update(String id, UpdateSsoConfigRequest request) {
        SsoConfigEntity entity = findActive(id);
        if (request.getVersion() != null && !entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "SSO 配置版本不匹配");
        }
        if (request.getProviderType() != null) {
            entity.setProviderType(request.getProviderType());
        }
        if (request.getClientId() != null) {
            entity.setClientId(request.getClientId());
        }
        if (request.getClientSecret() != null) {
            entity.setClientSecretEncrypted(encryptSecret(request.getClientSecret()));
        }
        if (request.getRedirectUri() != null) {
            entity.setRedirectUri(request.getRedirectUri());
        }
        if (request.getScopes() != null) {
            entity.setScopes(request.getScopes());
        }
        if (request.getConfig() != null) {
            entity.setConfig(request.getConfig());
        }
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
        }
        entity.setUpdatedBy(currentOperator());
        return toResponse(ssoConfigRepository.save(entity));
    }

    @Transactional
    public void softDelete(String id) {
        SsoConfigEntity entity = findActive(id);
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        ssoConfigRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public AuthorizeUrlResponse getAuthorizeUrl(String provider) {
        SsoConfigEntity config = findEnabledByProviderName(provider);
        String state = UUID.randomUUID().toString().replace("-", "");
        String authorizeUrl = buildAuthorizeUrl(config, state);
        return AuthorizeUrlResponse.builder()
                .provider(provider)
                .authorizeUrl(authorizeUrl)
                .state(state)
                .build();
    }

    @Transactional
    public SsoLoginResponse handleCallback(String provider, SsoCallbackRequest request) {
        SsoConfigEntity config = findEnabledByProviderName(provider);
        // 简化实现：未真实调用 token 端点，依据 code 派生稳定 subject 模拟外部身份。
        String subject = deriveSubject(provider, request.getCode());
        UserEntity user = findOrCreateUser(config.getTenantId(), provider, subject);
        return issueLoginResponse(user);
    }

    @Transactional
    public SsoLoginResponse handleSamlAssertion(String provider, SamlAssertionRequest request) {
        SsoConfigEntity config = findEnabledByProviderName(provider);
        String nameId = extractSamlNameId(request.getSamlResponse());
        UserEntity user = findOrCreateUser(config.getTenantId(), provider, nameId);
        return issueLoginResponse(user);
    }

    private SsoLoginResponse issueLoginResponse(UserEntity user) {
        boolean mfaRequired = mfaConfigRepository.existsByUserIdAndEnabledTrue(user.getId());
        if (mfaRequired) {
            return SsoLoginResponse.builder()
                    .loginResult("MFA_REQUIRED")
                    .userId(user.getId())
                    .username(user.getUsername())
                    .mfaRequired(true)
                    .loginAt(Instant.now())
                    .build();
        }
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername(), user.getTenantId(), DEFAULT_ROLES);
        return SsoLoginResponse.builder()
                .loginResult("SUCCESS")
                .userId(user.getId())
                .username(user.getUsername())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessExpirationSeconds())
                .mfaRequired(false)
                .loginAt(Instant.now())
                .build();
    }

    private UserEntity findOrCreateUser(String tenantId, String provider, String subject) {
        String username = provider + "_" + subject;
        return userRepository.findByTenantIdAndUsername(tenantId, username)
                .orElseGet(() -> {
                    UserEntity created = UserEntity.builder()
                            .id(UUID.randomUUID().toString())
                            .tenantId(tenantId)
                            .username(username)
                            .email(username + "@sso.local")
                            .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .status(UserEntity.UserStatus.ENABLED)
                            .requirePasswordReset(false)
                            .build();
                    return userRepository.save(created);
                });
    }

    private String buildAuthorizeUrl(SsoConfigEntity config, String state) {
        String base = resolveAuthorizeEndpoint(config);
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(base)
                .queryParam("client_id", config.getClientId())
                .queryParam("response_type", "code")
                .queryParam("state", state);
        if (config.getRedirectUri() != null && !config.getRedirectUri().isBlank()) {
            builder.queryParam("redirect_uri", config.getRedirectUri());
        }
        if (config.getScopes() != null && !config.getScopes().isBlank()) {
            builder.queryParam("scope", config.getScopes());
        }
        return builder.build().encode().toUriString();
    }

    private String resolveAuthorizeEndpoint(SsoConfigEntity config) {
        // SAML 直接使用 redirect_uri 作为 ACS 端点；OAuth2/OIDC 使用配置或默认推导。
        if (config.getProviderType() == SsoConfigEntity.ProviderType.SAML) {
            return config.getRedirectUri() != null ? config.getRedirectUri() : "/saml/login";
        }
        if (config.getConfig() != null && config.getConfig().contains("authorizeUrl")) {
            int idx = config.getConfig().indexOf("authorizeUrl");
            String sub = config.getConfig().substring(idx);
            int colon = sub.indexOf(':');
            int end = sub.indexOf(',', colon);
            if (colon > 0) {
                String raw = end < 0 ? sub.substring(colon + 1) : sub.substring(colon + 1, end);
                return raw.replaceAll("\"", "").replaceAll("\\\\", "").trim();
            }
        }
        return "https://" + config.getProviderName() + ".example.com/oauth2/authorize";
    }

    private String deriveSubject(String provider, String code) {
        String raw = provider + ":" + code;
        byte[] hash = raw.getBytes(StandardCharsets.UTF_8);
        String b64 = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        return b64.length() > 24 ? b64.substring(0, 24) : b64;
    }

    private String extractSamlNameId(String samlResponse) {
        try {
            String decoded = new String(Base64.getDecoder().decode(samlResponse), StandardCharsets.UTF_8);
            int start = decoded.indexOf("<NameID");
            if (start < 0) {
                start = decoded.indexOf(":NameID");
            }
            if (start < 0) {
                return "saml-subject";
            }
            int gt = decoded.indexOf('>', start);
            int lt = decoded.indexOf('<', gt);
            if (gt > 0 && lt > gt) {
                return decoded.substring(gt + 1, lt).trim();
            }
        } catch (Exception e) {
            log.warn("Failed to parse SAML NameID, using fallback", e);
        }
        return "saml-subject";
    }

    private String encryptSecret(String secret) {
        // 演示阶段：直接存储，生产应使用 KMS/对称加密。保留方法以便后续替换。
        return secret;
    }

    private SsoConfigEntity findActive(String id) {
        return ssoConfigRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "SSO 配置不存在"));
    }

    private SsoConfigEntity findEnabledByProviderName(String provider) {
        return ssoConfigRepository.findByTenantIdAndProviderNameAndDeletedFalse(DEFAULT_TENANT_ID, provider)
                .filter(c -> Boolean.TRUE.equals(c.getEnabled()))
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "SSO 提供方未配置或未启用: " + provider));
    }

    private SsoConfigResponse toResponse(SsoConfigEntity c) {
        return SsoConfigResponse.builder()
                .id(c.getId())
                .tenantId(c.getTenantId())
                .providerName(c.getProviderName())
                .providerType(c.getProviderType())
                .clientId(c.getClientId())
                .redirectUri(c.getRedirectUri())
                .scopes(c.getScopes())
                .config(c.getConfig())
                .enabled(c.getEnabled())
                .version(c.getVersion())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .createdBy(c.getCreatedBy())
                .updatedBy(c.getUpdatedBy())
                .build();
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? DEFAULT_TENANT_ID : requestTenantId;
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}
