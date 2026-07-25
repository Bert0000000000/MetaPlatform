package com.metaplatform.llmgw.functions;

import org.springframework.ai.tool.ToolCallback;

import java.util.List;

public interface ToolProvider {
    List<ToolCallback> provideTools();
}
