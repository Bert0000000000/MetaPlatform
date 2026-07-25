package com.metaplatform.agent.tools;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 调用工具请求。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvokeToolRequest {

    private Map<String, Object> input;
}
