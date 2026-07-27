package com.metaplatform.iam.dto.apikey;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;

/**
 * 更新 API Key 权限范围请求。permissions 为空列表表示清空权限。
 */
@Data
public class UpdatePermissionsRequest {

    private List<@Valid PermissionEntry> permissions;
}
