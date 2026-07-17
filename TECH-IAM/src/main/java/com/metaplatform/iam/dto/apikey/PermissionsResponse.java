package com.metaplatform.iam.dto.apikey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * API Key 权限范围响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionsResponse {

    private String apiKeyId;
    private List<PermissionEntry> permissions;
}
