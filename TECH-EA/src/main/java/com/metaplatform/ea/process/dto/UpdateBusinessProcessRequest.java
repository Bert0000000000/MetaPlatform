package com.metaplatform.ea.process.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class UpdateBusinessProcessRequest {

    private String name;
    private String description;
    private UUID valueStreamId;
    private List<UUID> capabilities;
    private List<Map<String, Object>> processSteps;
    private String status;
}
