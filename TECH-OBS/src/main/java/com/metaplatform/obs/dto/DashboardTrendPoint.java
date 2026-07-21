package com.metaplatform.obs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardTrendPoint {

    private String time;
    private double value;
    private double apiCalls;
    private double errors;
}
