package com.metaplatform.ea.debt.dto;

import lombok.Data;

@Data
public class UpdateTechDebtRequest {
    private String title;
    private String category;
    private String severity;
    private String status;
    private String description;
    private Integer impactScore;
    private String remediation;
    private String estimatedEffort;
    private String owner;
    private String metadata;
}