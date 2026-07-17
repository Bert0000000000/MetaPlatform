package com.metaplatform.obs.slo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorBudget {

    private double target;
    private double totalBudget;
    private double consumedBudget;
    private double remainingBudget;
    private double burnRate;
    private String status;
    private String window;
}