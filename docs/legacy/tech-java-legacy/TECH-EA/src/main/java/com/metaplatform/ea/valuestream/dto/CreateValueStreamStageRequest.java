package com.metaplatform.ea.valuestream.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateValueStreamStageRequest {

    @NotBlank(message = "阶段名称不能为空")
    private String name;

    private String description;

    private List<UUID> capabilityIds;

    private List<String> outputs;

    private List<UUID> participantRoleIds;

    private Integer sortOrder;
}