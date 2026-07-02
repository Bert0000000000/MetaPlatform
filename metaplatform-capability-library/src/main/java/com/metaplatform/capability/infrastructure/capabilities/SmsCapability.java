package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 短信发送能力。v0.1 模拟实现。
 */
@Component
public class SmsCapability implements Capability {

    @Override
    public String name() { return "sms"; }

    @Override
    public String description() { return "发送短信消息"; }

    @Override
    public CapabilityType type() { return CapabilityType.COMMUNICATION; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String phoneNumber = context.getStringParameter("phoneNumber");
        String message = context.getStringParameter("message");

        if (phoneNumber == null || phoneNumber.isBlank()) {
            return CapabilityResult.failure("'phoneNumber' parameter is required", System.currentTimeMillis() - start);
        }

        // v0.1 模拟发送
        return CapabilityResult.success(
                "SMS sent to " + phoneNumber,
                Map.of("phoneNumber", phoneNumber, "message", message != null ? message : ""),
                System.currentTimeMillis() - start
        );
    }
}
