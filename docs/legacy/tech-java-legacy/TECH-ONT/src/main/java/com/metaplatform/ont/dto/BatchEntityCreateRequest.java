package com.metaplatform.ont.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class BatchEntityCreateRequest {

    @NotBlank(message = "所属概念 ID 不能为空")
    @Size(max = 64, message = "概念 ID 长度不能超过 64")
    private String conceptId;

    @NotNull(message = "实体列表不能为空")
    @Size(min = 1, max = 100, message = "单次最多创建 100 条实体")
    @Valid
    private List<BatchEntityItem> entities;
}
