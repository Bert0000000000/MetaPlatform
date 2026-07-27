package com.metaplatform.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.config.McpAlertProperties;
import com.metaplatform.mcp.config.McpAuditProperties;
import com.metaplatform.mcp.config.McpIamProperties;
import com.metaplatform.mcp.config.McpNacosProperties;
import com.metaplatform.mcp.config.McpRateLimitProperties;
import com.metaplatform.mcp.config.McpRootProperties;
import com.metaplatform.mcp.jsonrpc.McpProtocolService;
import com.metaplatform.mcp.stdio.McpStdioServerLauncher;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.Arrays;

@SpringBootApplication
@EnableDiscoveryClient
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({
        McpRootProperties.class,
        McpIamProperties.class,
        McpAuditProperties.class,
        McpRateLimitProperties.class,
        McpNacosProperties.class
})
public class McpApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(McpApplication.class);
        if (stdioEnabled(args)) {
            application.setWebApplicationType(WebApplicationType.NONE);
        }
        application.run(args);
    }

    @Bean
    McpStdioServerLauncher mcpStdioServerLauncher(McpProtocolService protocolService, ObjectMapper objectMapper) {
        return new McpStdioServerLauncher(protocolService, objectMapper);
    }

    @Bean(name = "mcpAlertProperties")
    @Primary
    public McpAlertProperties alertPropertiesAlias(McpRootProperties root) {
        return root.getAlert();
    }

    @Bean
    ApplicationRunner stdioRunner(McpStdioServerLauncher launcher) {
        return args -> {
            if (stdioEnabled(args.getSourceArgs())) {
                launcher.run();
            }
        };
    }

    private static boolean stdioEnabled(String[] args) {
        return "true".equalsIgnoreCase(System.getenv("MCP_STDIO_MODE"))
                || Arrays.stream(args).anyMatch("--stdio=true"::equalsIgnoreCase);
    }
}
