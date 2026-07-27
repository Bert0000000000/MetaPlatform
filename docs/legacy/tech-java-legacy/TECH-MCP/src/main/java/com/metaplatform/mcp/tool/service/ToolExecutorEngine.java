package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.builtin.ToolExecutor;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.lang.reflect.Method;
import java.time.Duration;

/**
 * Pure tool execution engine: resolves a tool by its {@code toolType} and performs
 * the actual invocation (HTTP via WebClient or BEAN via ApplicationContext).
 * Holds no persistence concerns so it can be reused synchronously and asynchronously.
 */
@Component
@RequiredArgsConstructor
public class ToolExecutorEngine {

    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(30);

    private final WebClient.Builder webClientBuilder;
    private final ApplicationContext applicationContext;

    public String doExecute(McpToolEntity tool, String input) {
        String type = tool.getToolType() == null ? "" : tool.getToolType().toUpperCase();
        return switch (type) {
            case "HTTP", "MCP" -> executeHttp(tool, input);
            case "BEAN" -> executeBean(tool, input);
            default -> throw new McpException(ErrorCode.INVALID_PARAM, "不支持的 toolType: " + tool.getToolType());
        };
    }

    private String executeHttp(McpToolEntity tool, String input) {
        if (tool.getEndpoint() == null || tool.getEndpoint().isBlank()) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Tool endpoint 未配置");
        }
        String body = (input == null || input.isBlank()) ? "{}" : input;
        try {
            WebClient client = webClientBuilder.build();
            return client.post()
                    .uri(tool.getEndpoint())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(HTTP_TIMEOUT);
        } catch (Exception e) {
            throw new McpException(ErrorCode.TOOL_EXECUTION_ERROR, "HTTP 调用失败: " + rootMessage(e));
        }
    }

    private String executeBean(McpToolEntity tool, String input) {
        if (tool.getBeanClass() == null || tool.getBeanClass().isBlank()) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Tool beanClass 未配置");
        }
        try {
            Class<?> clazz = Class.forName(tool.getBeanClass(), false, applicationContext.getClassLoader());
            Object bean = applicationContext.getBean(clazz);
            if (bean instanceof ToolExecutor executor) {
                return executor.execute(tool.getCode(), input);
            }
            Method method = clazz.getMethod("execute", String.class, String.class);
            Object result = method.invoke(bean, tool.getCode(), input);
            return result == null ? null : String.valueOf(result);
        } catch (McpException e) {
            throw e;
        } catch (Exception e) {
            throw new McpException(ErrorCode.TOOL_EXECUTION_ERROR, "BEAN 调用失败: " + rootMessage(e));
        }
    }

    private String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        return cur.getMessage() == null ? cur.getClass().getSimpleName() : cur.getMessage();
    }
}
