package com.metaplatform.obs.anomaly.dto;

import com.metaplatform.obs.dto.LogEntry;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RootCauseAnalysisResult {

    private String conclusion;
    private String suggestedAction;
    private List<LogEntry> relatedLogs;
    private Map<String, Double> relatedMetrics;
}
