package com.metaplatform.obs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardMetricCard {

    private String key;
    private String label;
    private double value;
    private String unit;
    private double trend;
    private boolean trendUp;
    private String icon;
}
