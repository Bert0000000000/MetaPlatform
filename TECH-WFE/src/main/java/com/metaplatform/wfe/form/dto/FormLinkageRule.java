package com.metaplatform.wfe.form.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class FormLinkageRule {

    private String id;

    private String name;

    @NotNull(message = "联动条件不能为空")
    private WhenCondition when;

    @NotNull(message = "联动动作不能为空")
    private ThenAction then;

    @Data
    public static class WhenCondition {

        @NotBlank(message = "条件字段不能为空")
        private String fieldKey;

        @Pattern(regexp = "eq|ne|contains|gt|lt|gte|lte|in", message = "不支持的操作符")
        private String operator;

        private Object value;
    }

    @Data
    public static class ThenAction {

        @NotBlank(message = "动作字段不能为空")
        private String fieldKey;

        @Pattern(regexp = "show|hide|require|optional|readonly|editable|setOptions|setValue",
                message = "不支持的联动动作")
        private String action;

        private Object value;

        private List<Map<String, Object>> options;
    }
}
