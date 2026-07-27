package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Cypher 查询模板创建/更新请求（V12-05 REQ-063）。
 * 分类固定为 concept / relation / path / aggregate。
 */
@Getter
@Setter
public class CypherTemplateCreateRequest {

    @NotBlank(message = "模板名称不能为空")
    @Size(max = 256, message = "模板名称过长")
    private String name;

    @NotBlank(message = "模板分类不能为空")
    @Pattern(
        regexp = "concept|relation|path|aggregate",
        message = "分类必须为 concept / relation / path / aggregate"
    )
    private String category;

    @Size(max = 2000, message = "描述过长")
    private String description;

    @NotBlank(message = "Cypher 查询不能为空")
    @Size(max = 8000, message = "Cypher 查询语句过长")
    private String query;

    private List<String> tags;
}
