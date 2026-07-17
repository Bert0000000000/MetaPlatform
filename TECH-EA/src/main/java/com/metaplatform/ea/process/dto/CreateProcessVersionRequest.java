package com.metaplatform.ea.process.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateProcessVersionRequest {

    @NotNull(message = "processSteps 不能为空")
    private List<Map<String, Object>> processSteps;

    private Map<String, Object> flowchart;

    private String changeNote;
}