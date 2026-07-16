package com.metaplatform.iam.dto.apikey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * API Key 列表/详情响应（不含 key_hash，不含明文 key）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiKeyResponse {

    private String apiKeyId;
    private String name;
    private String keyPrefix;
    private String userId;
    private List<String> scopes;
    private String status;
    private Instant expiresAt;
    private Instant lastUsedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
