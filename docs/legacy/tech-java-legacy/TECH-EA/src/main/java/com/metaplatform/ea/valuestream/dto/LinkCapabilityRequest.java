package com.metaplatform.ea.valuestream.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class LinkCapabilityRequest {

    @NotNull(message = "能力 ID 列表不能为空")
    private List<UUID> capabilityIds;

    private String stageName;
}
