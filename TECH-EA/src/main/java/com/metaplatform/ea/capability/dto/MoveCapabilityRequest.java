package com.metaplatform.ea.capability.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class MoveCapabilityRequest {

    private UUID newParentId;
}
