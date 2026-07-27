package com.metaplatform.obs.alert.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertStatistics {

    private long active;
    private long firing;
    private long silenced;
    private long recoveredToday;
    private Map<String, Long> bySeverity;
}