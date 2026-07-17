package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OntologyVersionCreateRequest {

    @NotBlank(message = "版本名称不能为空")
    @Size(max = 256, message = "版本名称长度不能超过 256")
    private String name;

    @Size(max = 2048, message = "版本描述长度不能超过 2048")
    private String description;
}
