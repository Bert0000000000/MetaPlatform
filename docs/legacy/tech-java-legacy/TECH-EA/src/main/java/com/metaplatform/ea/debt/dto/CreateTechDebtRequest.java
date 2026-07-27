package com.metaplatform.ea.debt.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateTechDebtRequest {

    @NotBlank(message = "技术债标题不能为空")
    private String title;

    @NotBlank(message = "技术债编码不能为空")
    private String code;

    private String category;
    private String severity;
    private String status;
    private String scopeType;
    private UUID scopeId;
    private String description;
    private Integer impactScore;
    private String remediation;
    private String estimatedEffort;
    private String owner;
    private String debtLevel;
    private String repaymentPlan;
    private String metadata;
}