package com.metaplatform.ea.capabilitymap.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SetRootCapabilityRequest(
        @NotNull(message = "rootCapabilityId 不能为空")
        UUID rootCapabilityId
) {
}
