package com.metaplatform.ea.application.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AddDependencyRequest {

    @NotNull(message = "依赖应用 ID 不能为空")
    private UUID dependencyId;

    private String dependencyType;
    private String description;
}
