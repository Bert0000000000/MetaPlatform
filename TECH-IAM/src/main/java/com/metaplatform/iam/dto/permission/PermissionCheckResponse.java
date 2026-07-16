package com.metaplatform.iam.dto.permission;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionCheckResponse {

    private boolean allowed;
    private String reason;
    private List<String> matchedPermissions;
}
