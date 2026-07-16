package com.metaplatform.iam.dto.apikey;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class CreateApiKeyRequest {

    @NotBlank(message = "name 不能为空")
    @Size(max = 128, message = "name 长度不能超过 128")
    private String name;

    @NotBlank(message = "userId 不能为空")
    @Size(max = 64, message = "userId 长度不能超过 64")
    private String userId;

    private List<String> scopes;

    private Instant expiresAt;

    private String tenantId;
}
