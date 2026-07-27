package com.metaplatform.rule.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimelinePoint {
    private LocalDate date;
    private long totalExecutions;
    private long hitExecutions;
    private long missExecutions;
    private long errorExecutions;
}
