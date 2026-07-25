package com.metaplatform.agent.evaluation;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 自动评分请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutoScoreRequest {

    private String rubricId;
}
