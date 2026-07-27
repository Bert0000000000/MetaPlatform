package com.metaplatform.ea.capabilitymap.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateVersionRequest(
        @NotBlank(message = "version 不能为空")
        String version,

        String createdBy
) {
}
