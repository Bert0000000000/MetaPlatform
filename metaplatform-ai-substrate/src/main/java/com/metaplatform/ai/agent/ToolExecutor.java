package com.metaplatform.ai.agent;

import java.util.Map;

/**
 * Tool executor interface: each tool implements one executor.
 */
public interface ToolExecutor {

    /** Tool name (corresponds to ToolDefinition) */
    String toolName();

    /** Execute the tool */
    String execute(Map<String, Object> arguments);
}
