package com.metaplatform.ea.valuestream.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateValueStreamStageRequest {

    @NotBlank(message = "阶段名称不能为空")
    private String name;

    private String description;

    private Integer sortOrder;
}