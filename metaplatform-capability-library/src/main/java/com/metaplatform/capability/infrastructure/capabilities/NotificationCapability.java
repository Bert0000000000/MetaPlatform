package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 通知发送能力。v0.1 模拟实现（支持多种通知渠道）。
 */
@Component
public class NotificationCapability implements Capability {

    @Override
    public String name() { return "notification"; }

    @Override
    public String description() { return "发送平台内通知"; }

    @Override
    public CapabilityType type() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String userId = context.getStringParameter("userId");
        String title = context.getStringParameter("title");
        String message = context.getStringParameter("message");

        if (userId == null || userId.isBlank()) {
            return CapabilityResult.failure("'userId' parameter is required", System.currentTimeMillis() - start);
        }

        // v0.1 模拟通知
        return CapabilityResult.success(
                "Notification sent to " + userId,
                Map.of("userId", userId, "title", title != null ? title : "",
                        "message", message != null ? message : ""),
                System.currentTimeMillis() - start
        );
    }
}
