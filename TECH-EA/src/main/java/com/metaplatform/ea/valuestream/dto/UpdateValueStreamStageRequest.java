package com.metaplatform.ea.valuestream.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateValueStreamStageRequest {
    private String name;
    private String description;
    private List<UUID> capabilityIds;
    private List<String> outputs;
    private List<UUID> participantRoleIds;
    private Integer sortOrder;
}