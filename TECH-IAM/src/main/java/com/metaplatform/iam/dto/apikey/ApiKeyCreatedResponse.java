package com.metaplatform.iam.dto.apikey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * API Key 创建响应（含明文 key，仅此一次返回）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiKeyCreatedResponse {

    private String apiKeyId;
    private String name;
    private String keyPrefix;
    private String apiKey;
    private String userId;
    private List<String> scopes;
    private String status;
    private Instant expiresAt;
    private Instant createdAt;
}
