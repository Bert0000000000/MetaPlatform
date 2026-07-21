package com.metaplatform.wfe.form.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class FormFieldMeta {

    @NotBlank(message = "字段 id 不能为空")
    private String id;

    @NotBlank(message = "字段类型不能为空")
    private String type;

    @NotBlank(message = "字段标签不能为空")
    private String label;

    @NotBlank(message = "字段标识不能为空")
    private String fieldKey;

    private Boolean required;

    private Boolean readonly;

    private Boolean hidden;

    private List<Map<String, Object>> options;
}
