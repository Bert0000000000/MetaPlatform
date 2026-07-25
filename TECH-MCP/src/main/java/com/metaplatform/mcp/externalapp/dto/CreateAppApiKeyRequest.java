package com.metaplatform.mcp.externalapp.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateAppApiKeyRequest(
        @NotBlank(message = "name 不能为空") String name
) {
}
