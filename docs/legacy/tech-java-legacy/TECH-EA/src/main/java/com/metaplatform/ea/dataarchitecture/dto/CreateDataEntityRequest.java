package com.metaplatform.ea.dataarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateDataEntityRequest {

    @NotBlank(message = "数据实体名称不能为空")
    private String name;

    @NotBlank(message = "数据实体编码不能为空")
    private String code;

    private String description;
    private String entityType;
    private List<DataField> fields;
    private UUID domainId;
}
