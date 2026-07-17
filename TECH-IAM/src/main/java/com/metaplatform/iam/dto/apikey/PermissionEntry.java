package com.metaplatform.iam.dto.apikey;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 单条权限范围：指定资源 + 允许的操作列表。
 * 例：{ "resource": "ont:concepts", "actions": ["read","write"] }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionEntry {

    @NotBlank(message = "resource 不能为空")
    private String resource;

    @NotNull(message = "actions 不能为空")
    private List<String> actions;
}
