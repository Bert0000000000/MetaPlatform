package com.metaplatform.wfe.apphub.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TemplateCommentRequest {

    @NotNull(message = "rating 不能为空")
    @Min(value = 1, message = "rating 最小为 1")
    @Max(value = 5, message = "rating 最大为 5")
    private Integer rating;

    private String comment;
}
