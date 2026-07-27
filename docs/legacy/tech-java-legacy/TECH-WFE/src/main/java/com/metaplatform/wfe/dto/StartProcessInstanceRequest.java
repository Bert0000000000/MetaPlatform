package com.metaplatform.wfe.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class StartProcessInstanceRequest {

    @NotBlank(message = "流程定义 ID 不能为空")
    private String processDefinitionId;

    private String businessKey;

    private Map<String, Object> variables;
}
