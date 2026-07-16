package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 邮件发送能力。v0.1 模拟实现。
 */
@Component
public class EmailCapability implements Capability {

    @Override
    public String name() { return "email"; }

    @Override
    public String description() { return "发送电子邮件"; }

    @Override
    public CapabilityType type() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String to = context.getStringParameter("to");
        String subject = context.getStringParameter("subject");
        String body = context.getStringParameter("body");

        if (to == null || to.isBlank()) {
            return CapabilityResult.failure("'to' parameter is required", System.currentTimeMillis() - start);
        }

        // v0.1 模拟发送
        return CapabilityResult.success(
                "Email sent to " + to,
                Map.of("to", to, "subject", subject != null ? subject : "", "body", body != null ? body : ""),
                System.currentTimeMillis() - start
        );
    }
}
