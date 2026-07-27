package com.metaplatform.wfe.form.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class FormGlobalSettingsRequest {

    @NotBlank(message = "表单标题不能为空")
    private String title;

    private String description;

    @Pattern(regexp = "none|tab|step", message = "标签页模式只能是 none/tab/step")
    private String tabMode;

    private String submitText;

    @Pattern(regexp = "default|compact|loose", message = "布局密度只能是 default/compact/loose")
    private String layoutDensity;
}
