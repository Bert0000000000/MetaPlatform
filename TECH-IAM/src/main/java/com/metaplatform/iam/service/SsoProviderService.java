package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.sso.CreateSsoProviderRequest;
import com.metaplatform.iam.dto.sso.SsoAuthResponse;
import com.metaplatform.iam.dto.sso.SsoAuthorizeResponse;
import com.metaplatform.iam.dto.sso.SsoCallbackRequest;
import com.metaplatform.iam.dto.sso.SsoMetadataResponse;
import com.metaplatform.iam.dto.sso.SsoProviderResponse;
import com.metaplatform.iam.dto.sso.SsoProviderType;
import com.metaplatform.iam.dto.sso.SsoTokenRequest;
import com.metaplatform.iam.dto.sso.UpdateSsoProviderRequest;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.sso.SsoProviderEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.SsoProviderRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SsoProviderService {

    private static final String DEFAULT_TENANT_ID = "tenant-default";
    private static final List<String> DEFAULT_ROLES = Collections.singletonList("USER");

    private final SsoProviderRepository ssoProviderRepository;
    private final UserRepository userRepository;
    private final UserMfaService userMfaService;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public SsoProviderResponse create(CreateSsoProviderRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        if (ssoProviderRepository.existsByTenantIdAndNameAndDeletedFalse(tenantId, request.getName())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "SSO 提供方名称在该租户下已存在");
        }
        String operator = currentOperator();
        SsoProviderEntity entity = SsoProviderEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .providerType(toEntityType(request.getProviderType()))
                .name(request.getName())
                .clientId(request.getClientId())
                .clientSecret(request.getClientSecret())
                .issuerUrl(request.getIssuerUrl())
                .authorizationEndpoint(request.getAuthorizationEndpoint())
                .tokenEndpoint(request.getTokenEndpoint())
                .userInfoEndpoint(request.getUserInfoEndpoint())
                .scopes(request.getScopes())
                .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                .config(toJson(request.getConfig()))
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        return toResponse(ssoProviderRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<SsoProviderResponse> list(String tenantId, String keyword, Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "name"));
        Page<SsoProviderEntity> result;
        if (keyword != null && !keyword.isBlank()) {
            result = ssoProviderRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = ssoProviderRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }
        List<SsoProviderResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<SsoProviderResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public SsoProviderResponse get(String id) {
        return toResponse(findActive(id));
    }

    @Transactional
    public SsoProviderResponse update(String id, UpdateSsoProviderRequest request) {
        SsoProviderEntity entity = findActive(id);
        if (request.getVersion() != null && !entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "SSO 提供方版本不匹配");
        }
        if (request.getName() != null && !request.getName().isBlank()
                && !request.getName().equals(entity.getName())) {
            if (ssoProviderRepository.existsByTenantIdAndNameAndDeletedFalse(entity.getTenantId(), request.getName())) {
                throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "SSO 提供方名称在该租户下已存在");
            }
            entity.setName(request.getName());
        }
        Optional.ofNullable(request.getProviderType()).ifPresent(t -> entity.setProviderType(toEntityType(t)));
        Optional.ofNullable(request.getClientId()).ifPresent(entity::setClientId);
        Optional.ofNullable(request.getClientSecret()).ifPresent(entity::setClientSecret);
        Optional.ofNullable(request.getIssuerUrl()).ifPresent(entity::setIssuerUrl);
        Optional.ofNullable(request.getAuthorizationEndpoint()).ifPresent(entity::setAuthorizationEndpoint);
        Optional.ofNullable(request.getTokenEndpoint()).ifPresent(entity::setTokenEndpoint);
        Optional.ofNullable(request.getUserInfoEndpoint()).ifPresent(entity::setUserInfoEndpoint);
        Optional.ofNullable(request.getScopes()).ifPresent(entity::setScopes);
        Optional.ofNullable(request.getEnabled()).ifPresent(entity::setEnabled);
        Optional.ofNullable(request.getConfig()).ifPresent(c -> entity.setConfig(toJson(c)));
        entity.setUpdatedBy(currentOperator());
        return toResponse(ssoProviderRepository.save(entity));
    }

    @Transactional
    public void delete(String id) {
        SsoProviderEntity entity = findActive(id);
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        ssoProviderRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public SsoMetadataResponse getMetadata(String id) {
        SsoProviderEntity entity = findActive(id);
        String metadata;
        if (entity.getProviderType() == SsoProviderEntity.ProviderType.SAML) {
            metadata = buildSamlMetadata(entity);
        } else {
            metadata = buildOidcDiscovery(entity);
        }
        return SsoMetadataResponse.builder()
                .providerType(entity.getProviderType().name())
                .metadata(metadata)
                .build();
    }

    @Transactional(readOnly = true)
    public SsoAuthorizeResponse buildAuthorizeUrl(String id) {
        SsoProviderEntity entity = findEnabled(id);
        String state = UUID.randomUUID().toString().replace("-", "");
        String base = resolveAuthorizationEndpoint(entity);
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(base)
                .queryParam("client_id", entity.getClientId())
                .queryParam("response_type", "code")
                .queryParam("state", state);
        if (entity.getIssuerUrl() != null && !entity.getIssuerUrl().isBlank()) {
            builder.queryParam("redirect_uri", entity.getIssuerUrl());
        }
        if (entity.getScopes() != null && !entity.getScopes().isBlank()) {
            builder.queryParam("scope", entity.getScopes());
        }
        return SsoAuthorizeResponse.builder()
                .providerId(id)
                .authorizeUrl(builder.build().encode().toUriString())
                .state(state)
                .build();
    }

    @Transactional
    public SsoAuthResponse handleCallback(String id, SsoCallbackRequest request) {
        SsoProviderEntity entity = findEnabled(id);
        String subject = deriveSubject(entity.getName(), request.getCode());
        UserEntity user = findOrCreateUser(entity.getTenantId(), entity.getName(), subject);
        return issueLoginResponse(user);
    }

    @Transactional
    public SsoAuthResponse handleTokenExchange(String id, SsoTokenRequest request) {
        SsoProviderEntity entity = findEnabled(id);
        String subject = extractSamlNameId(request.getAssertion());
        UserEntity user = findOrCreateUser(entity.getTenantId(), entity.getName(), subject);
        return issueLoginResponse(user);
    }

    private SsoProviderEntity findActive(String id) {
        return ssoProviderRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "SSO 提供方不存在"));
    }

    private SsoProviderEntity findEnabled(String id) {
        SsoProviderEntity entity = findActive(id);
        if (!Boolean.TRUE.equals(entity.getEnabled())) {
            throw new IamException(ErrorCode.NOT_FOUND, "SSO 提供方未启用");
        }
        return entity;
    }

    private String resolveAuthorizationEndpoint(SsoProviderEntity entity) {
        if (entity.getAuthorizationEndpoint() != null && !entity.getAuthorizationEndpoint().isBlank()) {
            return entity.getAuthorizationEndpoint();
        }
        if (entity.getProviderType() == SsoProviderEntity.ProviderType.SAML) {
            return entity.getIssuerUrl() != null ? entity.getIssuerUrl() : "https://" + entity.getName() + ".example.com/saml/acs";
        }
        return "https://" + entity.getName() + ".example.com/oauth2/authorize";
    }

    private String buildOidcDiscovery(SsoProviderEntity entity) {
        Map<String, Object> discovery = Map.of(
                "issuer", entity.getIssuerUrl() != null ? entity.getIssuerUrl() : "https://" + entity.getName() + ".example.com",
                "authorization_endpoint", resolveAuthorizationEndpoint(entity),
                "token_endpoint", entity.getTokenEndpoint() != null ? entity.getTokenEndpoint() : "https://" + entity.getName() + ".example.com/oauth2/token",
                "userinfo_endpoint", entity.getUserInfoEndpoint() != null ? entity.getUserInfoEndpoint() : "https://" + entity.getName() + ".example.com/oauth2/userinfo",
                "scopes_supported", entity.getScopes() != null ? List.of(entity.getScopes().split(" ")) : List.of("openid", "profile", "email")
        );
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(discovery);
        } catch (Exception e) {
            throw new IamException(ErrorCode.INTERNAL_ERROR, "生成 OIDC 发现文档失败");
        }
    }

    private String buildSamlMetadata(SsoProviderEntity entity) {
        String entityId = entity.getIssuerUrl() != null ? entity.getIssuerUrl() : "https://" + entity.getName() + ".example.com";
        String acs = entity.getAuthorizationEndpoint() != null ? entity.getAuthorizationEndpoint() : entityId + "/saml/acs";
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<md:EntityDescriptor xmlns:md=\"urn:oasis:names:tc:SAML:2.0:metadata\" entityID=\"" + entityId + "\">\n"
                + "  <md:SPSSODescriptor protocolSupportEnumeration=\"urn:oasis:names:tc:SAML:2.0:protocol\">\n"
                + "    <md:AssertionConsumerService Binding=\"urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST\" Location=\"" + acs + "\" index=\"0\"/>\n"
                + "  </md:SPSSODescriptor>\n"
                + "</md:EntityDescriptor>";
    }

    private UserEntity findOrCreateUser(String tenantId, String providerName, String subject) {
        String username = providerName + "_" + subject;
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

    private SsoAuthResponse issueLoginResponse(UserEntity user) {
        boolean mfaRequired = userMfaService.isMfaEnabled(user.getId());
        if (mfaRequired) {
            return SsoAuthResponse.builder()
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
        return SsoAuthResponse.builder()
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

    private String deriveSubject(String providerName, String code) {
        String raw = providerName + ":" + code;
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

    private SsoProviderResponse toResponse(SsoProviderEntity entity) {
        return SsoProviderResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .providerType(toDtoType(entity.getProviderType()))
                .name(entity.getName())
                .clientId(entity.getClientId())
                .issuerUrl(entity.getIssuerUrl())
                .authorizationEndpoint(entity.getAuthorizationEndpoint())
                .tokenEndpoint(entity.getTokenEndpoint())
                .userInfoEndpoint(entity.getUserInfoEndpoint())
                .scopes(entity.getScopes())
                .enabled(entity.getEnabled())
                .config(fromJson(entity.getConfig()))
                .version(entity.getVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private SsoProviderEntity.ProviderType toEntityType(SsoProviderType type) {
        return SsoProviderEntity.ProviderType.valueOf(type.name());
    }

    private SsoProviderType toDtoType(SsoProviderEntity.ProviderType type) {
        return SsoProviderType.valueOf(type.name());
    }

    private String toJson(Map<String, Object> config) {
        if (config == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(config);
        } catch (Exception e) {
            throw new IamException(ErrorCode.INVALID_PARAM, "config 格式非法");
        }
    }

    private Map<String, Object> fromJson(String config) {
        if (config == null || config.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(config, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
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
