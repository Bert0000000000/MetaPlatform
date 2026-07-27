package com.metaplatform.agent.collaboration;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 单个员工在协作任务中的贡献汇总（V15-04）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Contribution {

    private String employeeId;
    private int subtaskCount;
    private int completedCount;
    private int failedCount;
    private int totalSeconds;
}
