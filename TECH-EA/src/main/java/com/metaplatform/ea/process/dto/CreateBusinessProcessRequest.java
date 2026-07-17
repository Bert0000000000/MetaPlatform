package com.metaplatform.ea.process.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class CreateBusinessProcessRequest {

    @NotBlank(message = "流程名称不能为空")
    private String name;

    @NotBlank(message = "流程编码不能为空")
    private String code;

    private String description;
    private UUID valueStreamId;
    private List<UUID> capabilities;
    private List<Map<String, Object>> processSteps;
}
