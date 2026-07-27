package com.metaplatform.ea.dataarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateDataAssetRequest {

    @NotBlank(message = "数据资产名称不能为空")
    private String name;

    @NotBlank(message = "数据资产编码不能为空")
    private String code;

    @NotBlank(message = "assetType 不能为空")
    private String assetType;

    private String description;
    private UUID entityId;
    private String classification;
    private String metadata;
    private List<String> tags;
}
