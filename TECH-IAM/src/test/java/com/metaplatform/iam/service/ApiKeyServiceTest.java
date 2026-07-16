package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyCreatedResponse;
import com.metaplatform.iam.dto.apikey.ApiKeyResponse;
import com.metaplatform.iam.entity.ApiKeyEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.ApiKeyRepository;
import com.metaplatform.iam.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiKeyServiceTest {

    @Mock
    private ApiKeyRepository apiKeyRepository;

    @Mock
    private UserRepository userRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ApiKeyService apiKeyService;

    @Test
    void create_shouldReturnCreatedResponseWithPlaintextKey() {
        String tenantId = "tenant-default";
        String userId = "user-001";
        String name = "test-key";
        List<String> scopes = List.of("ont:read", "iam:write");

        when(userRepository.existsById(userId)).thenReturn(true);
        when(apiKeyRepository.existsByTenantIdAndName(tenantId, name)).thenReturn(false);
        when(apiKeyRepository.save(any(ApiKeyEntity.class))).thenAnswer(i -> i.getArgument(0));

        ApiKeyCreatedResponse response = apiKeyService.create(tenantId, name, userId, scopes, null);

        assertThat(response.getApiKey()).startsWith("mp_");
        assertThat(response.getApiKey()).hasSize(35);
        assertThat(response.getKeyPrefix()).isEqualTo(response.getApiKey().substring(0, 8));
        assertThat(response.getName()).isEqualTo(name);
        assertThat(response.getUserId()).isEqualTo(userId);
        assertThat(response.getScopes()).containsExactly("ont:read", "iam:write");
        assertThat(response.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void create_shouldThrow_whenNameAlreadyExists() {
        when(userRepository.existsById("user-001")).thenReturn(true);
        when(apiKeyRepository.existsByTenantIdAndName("tenant-default", "dup-name")).thenReturn(true);

        assertThatThrownBy(() -> apiKeyService.create("tenant-default", "dup-name", "user-001", null, null))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("API Key 名称已存在");
    }

    @Test
    void create_shouldThrow_whenUserNotFound() {
        when(userRepository.existsById("ghost-user")).thenReturn(false);

        assertThatThrownBy(() -> apiKeyService.create("tenant-default", "key-1", "ghost-user", null, null))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("用户不存在");
    }

    @Test
    void list_shouldReturnPaginatedResponse() {
        String tenantId = "tenant-default";
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId(tenantId).name("key-1")
                .keyPrefix("mp_abcde").keyHash("hash-1").userId("user-001")
                .scopes("[\"ont:read\"]").status(ApiKeyEntity.Status.ACTIVE)
                .build();
        Page<ApiKeyEntity> page = new PageImpl<>(List.of(entity), PageRequest.of(0, 20), 1);

        when(apiKeyRepository.findByTenantId(eq(tenantId), any(PageRequest.class))).thenReturn(page);

        PageResponse<ApiKeyResponse> response = apiKeyService.list(tenantId, 0, 20);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getPage()).isEqualTo(0);
        assertThat(response.getSize()).isEqualTo(20);
        assertThat(response.getTotalPages()).isEqualTo(1);
        assertThat(response.getItems()).hasSize(1);
        ApiKeyResponse item = response.getItems().get(0);
        assertThat(item.getApiKeyId()).isEqualTo("ak-1");
        assertThat(item.getName()).isEqualTo("key-1");
        assertThat(item.getKeyPrefix()).isEqualTo("mp_abcde");
        assertThat(item.getScopes()).containsExactly("ont:read");
        assertThat(item.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void getById_shouldReturnResponse() {
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId("tenant-default").name("key-1")
                .keyPrefix("mp_abcde").keyHash("hash-1").userId("user-001")
                .scopes("[\"ont:read\"]").status(ApiKeyEntity.Status.ACTIVE)
                .build();
        when(apiKeyRepository.findById("ak-1")).thenReturn(Optional.of(entity));

        ApiKeyResponse response = apiKeyService.getById("ak-1");

        assertThat(response.getApiKeyId()).isEqualTo("ak-1");
        assertThat(response.getUserId()).isEqualTo("user-001");
        assertThat(response.getScopes()).containsExactly("ont:read");
    }

    @Test
    void revoke_shouldSetStatusToRevoked() {
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId("tenant-default").name("key-1")
                .keyPrefix("mp_abcde").keyHash("hash-1").userId("user-001")
                .status(ApiKeyEntity.Status.ACTIVE).build();
        when(apiKeyRepository.findById("ak-1")).thenReturn(Optional.of(entity));
        when(apiKeyRepository.save(any(ApiKeyEntity.class))).thenAnswer(i -> i.getArgument(0));

        apiKeyService.revoke("ak-1");

        assertThat(entity.getStatus()).isEqualTo(ApiKeyEntity.Status.REVOKED);
        verify(apiKeyRepository).save(entity);
    }

    @Test
    void revoke_shouldThrow_whenNotFound() {
        when(apiKeyRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> apiKeyService.revoke("non-existent"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("API Key 不存在");
    }

    @Test
    void validate_shouldReturnEntity_whenKeyIsValid() {
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId("tenant-default").name("key-1")
                .keyPrefix("mp_abcde").keyHash("some-hash").userId("user-001")
                .scopes("[\"ont:read\"]").status(ApiKeyEntity.Status.ACTIVE)
                .build();
        when(apiKeyRepository.findByKeyHash(any(String.class))).thenReturn(Optional.of(entity));
        when(apiKeyRepository.save(any(ApiKeyEntity.class))).thenAnswer(i -> i.getArgument(0));

        ApiKeyEntity result = apiKeyService.validate("mp_somevalidkey12345678901234567");

        assertThat(result).isSameAs(entity);
        assertThat(result.getLastUsedAt()).isNotNull();
        verify(apiKeyRepository).save(entity);
    }

    @Test
    void validate_shouldThrow_whenKeyIsRevoked() {
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId("tenant-default").name("key-1")
                .keyPrefix("mp_abcde").keyHash("some-hash").userId("user-001")
                .status(ApiKeyEntity.Status.REVOKED).build();
        when(apiKeyRepository.findByKeyHash(any(String.class))).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> apiKeyService.validate("mp_somevalidkey12345678901234567"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("API Key 已被吊销");
    }

    @Test
    void validate_shouldThrow_whenKeyIsExpired() {
        ApiKeyEntity entity = ApiKeyEntity.builder()
                .id("ak-1").tenantId("tenant-default").name("key-1")
                .keyPrefix("mp_abcde").keyHash("some-hash").userId("user-001")
                .status(ApiKeyEntity.Status.ACTIVE)
                .expiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();
        when(apiKeyRepository.findByKeyHash(any(String.class))).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> apiKeyService.validate("mp_somevalidkey12345678901234567"))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("API Key 已过期");
    }
}
