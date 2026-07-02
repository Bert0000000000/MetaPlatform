package com.metaplatform.capability.infrastructure.capabilities;

import com.metaplatform.capability.domain.Capability;
import com.metaplatform.capability.domain.CapabilityContext;
import com.metaplatform.capability.domain.CapabilityResult;
import com.metaplatform.capability.domain.CapabilityType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * AI 分类能力。v0.1 基于关键词规则的简化分类实现。
 */
@Component
public class AiClassificationCapability implements Capability {

    private static final Map<String, List<String>> CATEGORY_KEYWORDS = Map.of(
            "技术", List.of("代码", "bug", "开发", "编程", "技术", "架构", "API", "数据库", "部署"),
            "商务", List.of("合同", "客户", "销售", "订单", "收入", "利润", "商务", "合作"),
            "人事", List.of("员工", "招聘", "培训", "绩效", "薪资", "考勤", "入职", "离职"),
            "财务", List.of("发票", "报销", "预算", "账单", "费用", "付款", "收款")
    );

    @Override
    public String name() { return "ai-classification"; }

    @Override
    public String description() { return "AI 文本分类"; }

    @Override
    public CapabilityType type() { return CapabilityType.AI; }

    @Override
    public CapabilityResult execute(CapabilityContext context) {
        long start = System.currentTimeMillis();
        String text = context.getStringParameter("text");

        if (text == null || text.isBlank()) {
            return CapabilityResult.failure("'text' parameter is required", System.currentTimeMillis() - start);
        }

        String bestCategory = "未分类";
        int bestScore = 0;

        for (var entry : CATEGORY_KEYWORDS.entrySet()) {
            int score = 0;
            for (String keyword : entry.getValue()) {
                if (text.contains(keyword)) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestCategory = entry.getKey();
            }
        }

        double confidence = bestScore > 0 ? Math.min(1.0, 0.5 + bestScore * 0.15) : 0.1;

        return CapabilityResult.success(
                "Classification: " + bestCategory,
                Map.of("category", bestCategory, "confidence", confidence, "matchedKeywords", bestScore),
                System.currentTimeMillis() - start
        );
    }
}
