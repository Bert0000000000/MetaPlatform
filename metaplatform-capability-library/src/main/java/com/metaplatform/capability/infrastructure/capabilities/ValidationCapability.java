package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 数据验证能力。v0.1 支持必填字段和类型检查。
 */
@Component
public class ValidationCapability implements Capability {

    @Override
    public String name() { return "validation"; }

    @Override
    public String description() { return "数据字段验证"; }

    @Override
    public CapabilityType type() { return CapabilityType.DATA; }

    @Override
    @SuppressWarnings("unchecked")
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        Object dataObj = context.getParameter("data");
        Object rulesObj = context.getParameter("rules");

        if (dataObj == null) {
            return CapabilityResult.failure("'data' parameter is required", System.currentTimeMillis() - start);
        }

        List<String> errors = new ArrayList<>();

        if (dataObj instanceof Map<?, ?> data && rulesObj instanceof Map<?, ?> rules) {
            // 验证必填字段
            Object requiredFields = rules.get("required");
            if (requiredFields instanceof List<?> fields) {
                for (Object field : fields) {
                    String fieldName = field.toString();
                    if (!data.containsKey(fieldName) || data.get(fieldName) == null) {
                        errors.add("Required field missing: " + fieldName);
                    }
                }
            }
        }

        boolean valid = errors.isEmpty();

        return CapabilityResult.success(
                valid ? "Validation passed" : "Validation failed with " + errors.size() + " error(s)",
                Map.of("valid", valid, "errors", errors),
                System.currentTimeMillis() - start
        );
    }
}
