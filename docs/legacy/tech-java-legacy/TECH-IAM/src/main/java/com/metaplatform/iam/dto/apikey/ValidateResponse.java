package com.metaplatform.iam.dto.apikey;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 验证 API Key + 权限检查响应。
 * - valid=false：Key 无效（不存在/已吊销/已过期）或无指定资源操作权限
 * - valid=true：Key 有效且具备 resource+action 权限，附带身份与权限范围
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidateResponse {

    private boolean valid;
    private String userId;
    private String tenantId;
    private List<PermissionEntry> permissions;
}
