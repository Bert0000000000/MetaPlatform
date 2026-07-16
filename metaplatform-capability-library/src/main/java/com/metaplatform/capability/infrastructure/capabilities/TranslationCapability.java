package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 翻译能力。v0.1 模拟实现（标记已翻译）。
 */
@Component
public class TranslationCapability implements Capability {

    @Override
    public String name() { return "translation"; }

    @Override
    public String description() { return "多语言文本翻译"; }

    @Override
    public CapabilityType type() { return CapabilityType.AI; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String text = context.getStringParameter("text");
        String targetLanguage = context.getStringParameter("targetLanguage");

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("'text' parameter is required", System.currentTimeMillis() - start);
        }
        if (targetLanguage == null || targetLanguage.isBlank()) {
            return CapabilityResult.failure("'targetLanguage' parameter is required", System.currentTimeMillis() - start);
        }

        // v0.1 模拟翻译
        String translated = "[Translated to " + targetLanguage + "] " + text;

        return CapabilityResult.success(
                "Translation completed",
                Map.of("translated", translated, "sourceLanguage", "auto-detected",
                        "targetLanguage", targetLanguage),
                System.currentTimeMillis() - start
        );
    }
}
