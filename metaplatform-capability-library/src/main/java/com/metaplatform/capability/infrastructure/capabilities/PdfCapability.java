package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * PDF 生成能力。v0.1 模拟实现。
 */
@Component
public class PdfCapability implements Capability {

    @Override
    public String name() { return "pdf"; }

    @Override
    public String description() { return "生成 PDF 文档"; }

    @Override
    public CapabilityType type() { return CapabilityType.FILE; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String content = context.getStringParameter("content");
        String filename = context.getStringParameter("filename");

        if (content == null || content.isBlank()) {
            return CapabilityResult.failure("'content' parameter is required", System.currentTimeMillis() - start);
        }

        String outputFilename = (filename != null && !filename.isBlank()) ? filename : "output.pdf";

        // v0.1 模拟 PDF 生成
        return CapabilityResult.success(
                "PDF generated: " + outputFilename,
                Map.of("filename", outputFilename, "contentLength", content.length(),
                        "format", "PDF"),
                System.currentTimeMillis() - start
        );
    }
}
