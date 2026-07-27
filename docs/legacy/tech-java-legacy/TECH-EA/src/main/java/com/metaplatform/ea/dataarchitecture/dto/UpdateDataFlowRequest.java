package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateDataFlowRequest {
    private String name;
    private UUID sourceEntityId;
    private UUID targetEntityId;
    private String flowType;
    private String description;
    private String schedule;
}
