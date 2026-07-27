package com.metaplatform.ea.dataarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateDataFlowRequest {

    @NotBlank(message = "数据流名称不能为空")
    private String name;

    @NotNull(message = "sourceEntityId 不能为空")
    private UUID sourceEntityId;

    @NotNull(message = "targetEntityId 不能为空")
    private UUID targetEntityId;

    private String flowType;
    private String description;
    private String schedule;
}