package com.metaplatform.rule.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdatePriorityRequest {

    @NotNull(message = "优先级不能为空")
    @Min(value = 0, message = "优先级不能为负数")
    @Max(value = 9999, message = "优先级不能超过 9999")
    private Integer priority;
}
