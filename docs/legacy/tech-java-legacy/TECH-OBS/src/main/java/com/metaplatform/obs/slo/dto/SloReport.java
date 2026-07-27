package com.metaplatform.obs.slo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SloReport {

    private String sloId;
    private String name;
    private String serviceName;
    private String period;
    private double target;
    private double actualAvailability;
    private ErrorBudget errorBudget;
    private String status;
    private Instant generatedAt;
    private String summary;
}