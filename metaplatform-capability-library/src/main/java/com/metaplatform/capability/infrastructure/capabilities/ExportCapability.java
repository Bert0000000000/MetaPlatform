package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 数据导出能力。v0.1 模拟实现（支持 JSON/CSV 格式）。
 */
@Component
public class ExportCapability implements Capability {

    @Override
    public String name() { return "export"; }

    @Override
    public String description() { return "数据导出（JSON/CSV）"; }

    @Override
    public CapabilityType type() { return CapabilityType.FILE; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String format = context.getStringParameter("format");
        String data = context.getStringParameter("data");

        if (data == null || data.isBlank()) {
            return CapabilityResult.failure("'data' parameter is required", System.currentTimeMillis() - start);
        }

        String outputFormat = (format != null && !format.isBlank()) ? format : "json";
        String filename = "export." + outputFormat.toLowerCase();

        // v0.1 模拟导出
        return CapabilityResult.success(
                "Data exported as " + outputFormat,
                Map.of("filename", filename, "format", outputFormat, "dataLength", data.length()),
                System.currentTimeMillis() - start
        );
    }
}
