package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * HTTP 请求能力。v0.1 模拟实现。
 */
@Component
public class HttpCapability implements Capability {

    @Override
    public String name() { return "http"; }

    @Override
    public String description() { return "发送 HTTP 请求"; }

    @Override
    public CapabilityType type() { return CapabilityType.NETWORK; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String url = context.getStringParameter("url");
        String method = context.getStringParameter("method");

        if (url == null || url.isBlank()) {
            return CapabilityResult.failure("'url' parameter is required", System.currentTimeMillis() - start);
        }

        String httpMethod = (method != null && !method.isBlank()) ? method.toUpperCase() : "GET";

        // v0.1 模拟 HTTP 请求
        return CapabilityResult.success(
                "HTTP " + httpMethod + " request sent to " + url,
                Map.of("url", url, "method", httpMethod, "statusCode", 200,
                        "body", "{\"status\":\"ok\"}"),
                System.currentTimeMillis() - start
        );
    }
}
