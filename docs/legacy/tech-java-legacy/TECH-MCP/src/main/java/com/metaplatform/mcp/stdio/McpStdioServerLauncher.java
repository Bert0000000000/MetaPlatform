package com.metaplatform.mcp.stdio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.McpApplication;
import com.metaplatform.mcp.jsonrpc.JsonRpcRequest;
import com.metaplatform.mcp.jsonrpc.JsonRpcResponse;
import com.metaplatform.mcp.jsonrpc.McpProtocolService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.ConfigurableApplicationContext;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

/**
 * stdio Transport 自研实现。
 *
 * <p>Spring AI 1.1.2 未发布 spring-ai-starter-mcp-server-stdio；
 * SAA 1.1.2.2 BOM 中亦未发布对应的 spring-ai-alibaba-starter-mcp-stdio。
 * 待 SAA 1.2.0+ 升级后，本类可由 spring-ai-alibaba-starter-mcp-stdio 替代；
 * 届时 {@code run()} 主体可迁移到 {@code StdioServerTransportProvider}。</p>
 *
 * <p>v1.3 阶段保留自研实现以支持 Claude Desktop 等本地 MCP Client。</p>
 */
@Slf4j
public class McpStdioServerLauncher {

    private final McpProtocolService protocolService;
    private final ObjectMapper objectMapper;
    private final InputStream input;
    private final OutputStream output;

    public McpStdioServerLauncher(McpProtocolService protocolService, ObjectMapper objectMapper) {
        this(protocolService, objectMapper, System.in, System.out);
    }

    public McpStdioServerLauncher(McpProtocolService protocolService, ObjectMapper objectMapper,
                                  InputStream input, OutputStream output) {
        this.protocolService = protocolService;
        this.objectMapper = objectMapper;
        this.input = input;
        this.output = output;
    }

    public void run() throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
             PrintWriter writer = new PrintWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8), true)) {
            String line;
            while ((line = reader.readLine()) != null) {
                try {
                    JsonRpcRequest request = objectMapper.readValue(line, JsonRpcRequest.class);
                    JsonRpcResponse response = protocolService.handle(request);
                    if (response != null) {
                        writer.println(objectMapper.writeValueAsString(response));
                    }
                } catch (Exception e) {
                    log.error("stdio MCP error", e);
                    writer.println(objectMapper.writeValueAsString(JsonRpcResponse.error(null, -32603,
                            e.getMessage() == null ? "Internal error" : e.getMessage())));
                }
            }
        }
    }

    public static void main(String[] args) throws IOException {
        SpringApplication application = new SpringApplication(McpApplication.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        try (ConfigurableApplicationContext context = application.run(args)) {
            context.getBean(McpStdioServerLauncher.class).run();
        }
    }
}
