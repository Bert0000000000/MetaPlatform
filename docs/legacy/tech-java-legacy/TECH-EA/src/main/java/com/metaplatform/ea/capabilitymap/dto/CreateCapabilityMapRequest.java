package com.metaplatform.ea.capabilitymap.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateCapabilityMapRequest(
        @NotBlank(message = "name 不能为空")
        @Size(max = 128, message = "name 长度不能超过 128")
        String name,

        @NotBlank(message = "code 不能为空")
        @Size(min = 3, max = 64, message = "code 长度需在 3-64 之间")
        @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "code 只能包含字母、数字和下划线")
        String code,

        String description,

        String businessDomain,

        String rootCapabilityName,

        String version
) {
}
