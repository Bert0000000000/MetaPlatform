package com.metaplatform.agent.execution;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 执行输出内容。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OutputContent {

    /** 文本内容。 */
    @Builder.Default
    private String content = "";

    /** 结构化数据（可选）。 */
    private Map<String, Object> structuredData;
}
