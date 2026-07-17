package com.metaplatform.ea.dataarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateDataDomainRequest {

    @NotBlank(message = "数据域名称不能为空")
    private String name;

    @NotBlank(message = "数据域编码不能为空")
    private String code;

    private String description;
    private String owner;
    private String metadata;
}