package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * AI 摘要能力。v0.1 简化实现（截取前200字符）。
 */
@Component
public class AiSummaryCapability implements Capability {

    @Override
    public String name() { return "ai-summary"; }

    @Override
    public String description() { return "AI 文本摘要生成"; }

    @Override
    public CapabilityType type() { return CapabilityType.AI; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String text = context.getStringParameter("text");

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("'text' parameter is required", System.currentTimeMillis() - start);
        }

        // v0.1 简化：截取前200字符作为摘要
        String summary = text.length() > 200 ? text.substring(0, 200) + "..." : text;

        return CapabilityResult.success(
                "Summary generated",
                Map.of("summary", summary, "originalLength", text.length()),
                System.currentTimeMillis() - start
        );
    }
}
