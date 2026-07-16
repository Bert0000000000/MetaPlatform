package com.metaplatform.wfe.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DeployRequest {

    @NotBlank(message = "流程定义 key 不能为空")
    @Size(max = 128, message = "流程定义 key 长度不能超过 128")
    private String processKey;

    @NotBlank(message = "流程定义名称不能为空")
    @Size(max = 256, message = "流程定义名称长度不能超过 256")
    private String name;

    @NotBlank(message = "BPMN XML 不能为空")
    private String bpmnXml;
}
