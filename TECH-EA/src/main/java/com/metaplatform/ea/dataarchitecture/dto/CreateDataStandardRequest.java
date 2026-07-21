package com.metaplatform.ea.dataarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateDataStandardRequest {

    @NotBlank(message = "数据标准编码不能为空")
    private String code;

    @NotBlank(message = "数据标准名称不能为空")
    private String name;

    @NotBlank(message = "数据标准类型不能为空")
    private String standardType;

    private String rule;
    private String description;
}
