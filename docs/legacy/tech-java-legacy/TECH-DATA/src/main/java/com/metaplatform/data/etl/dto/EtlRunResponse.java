package com.metaplatform.data.etl.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * ETL 任务执行运行记录。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EtlRunResponse {

    private String runId;
    private String taskId;
    private String status;
    private long rowsProcessed;
    private long bytesProcessed;
    private long latencyMs;
    private String errorMessage;
    private String triggeredBy;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;
}
