package com.metaplatform.ea.debt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDebtImpactResponse {
    private UUID debtId;
    private String code;
    private String severity;
    private Integer impactScore;
    private List<String> relatedOntologyConcepts;
    private List<UUID> affectedApplications;
    private List<String> recommendations;
    private String summary;
}