package com.metaplatform.mcp.builtin;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.exception.McpException;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * Shared base for built-in domain executors (ONT/RAG/ACTION). Each subclass binds a
 * downstream base URL and maps the invoked tool's code to a sub-path by stripping a
 * configured code prefix, then proxies the raw JSON input via a WebClient POST.
 */
public abstract class AbstractBuiltinToolExecutor implements ToolExecutor {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    private final WebClient webClient;
    private final String pathPrefix;
    private final String codePrefix;

    protected AbstractBuiltinToolExecutor(WebClient.Builder builder, String baseUrl,
                                          String pathPrefix, String codePrefix) {
        this.webClient = builder.baseUrl(baseUrl).build();
        this.pathPrefix = pathPrefix;
        this.codePrefix = codePrefix;
    }

    @Override
    public String execute(String toolCode, String input) {
        String action = stripPrefix(toolCode, codePrefix);
        String path = pathPrefix + action;
        String body = (input == null || input.isBlank()) ? "{}" : input;
        try {
            return webClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
        } catch (Exception e) {
            throw new McpException(ErrorCode.DEPENDENCY_ERROR,
                    "下游服务调用失败 [" + path + "]: " + rootMessage(e));
        }
    }

    private String stripPrefix(String toolCode, String prefix) {
        if (toolCode == null) {
            return "";
        }
        return toolCode.startsWith(prefix) ? toolCode.substring(prefix.length()) : toolCode;
    }

    private String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        return cur.getMessage() == null ? cur.getClass().getSimpleName() : cur.getMessage();
    }
}
