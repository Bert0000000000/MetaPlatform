package com.metaplatform.data.dbt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * dbt 编译/运行结果。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DbtRunResponse {

    private String runId;
    private String projectId;
    private String command;
    private String status;
    private List<String> modelsCompiled;
    private List<String> modelsRun;
    private int totalModels;
    private int successModels;
    private int failedModels;
    private long latencyMs;
    private String log;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;
}
