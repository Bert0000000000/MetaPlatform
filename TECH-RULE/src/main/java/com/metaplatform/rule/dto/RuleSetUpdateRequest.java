package com.metaplatform.rule.dto;

import com.metaplatform.rule.entity.RuleStatus;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RuleSetUpdateRequest {

    @Size(max = 128)
    private String name;

    private String description;

    private RuleStatus status;

    private Integer priority;

    private Boolean enabled;
}
