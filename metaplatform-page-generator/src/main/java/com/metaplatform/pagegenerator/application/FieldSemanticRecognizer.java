package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.FieldDescriptor;
import com.metaplatform.pagegenerator.domain.enums.DataType;
import com.metaplatform.pagegenerator.domain.enums.WidgetType;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 字段语义识别器 - 根据字段名称、数据类型自动推断最佳 WidgetType
 * 包含 30+ 语义模式匹配规则
 */
@Service
public class FieldSemanticRecognizer {

    // === 语义关键词映射表 (30+ patterns) ===
    private static final Map<String, WidgetType> SEMANTIC_RULES = Map.ofEntries(
            // 邮箱 (3 patterns)
            Map.entry("email", WidgetType.EMAIL),
            Map.entry("mail", WidgetType.EMAIL),
            Map.entry("邮箱", WidgetType.EMAIL),
            // 电话 (5 patterns)
            Map.entry("phone", WidgetType.PHONE),
            Map.entry("tel", WidgetType.PHONE),
            Map.entry("mobile", WidgetType.PHONE),
            Map.entry("电话", WidgetType.PHONE),
            Map.entry("手机", WidgetType.PHONE),
            // URL (4 patterns)
            Map.entry("url", WidgetType.URL),
            Map.entry("website", WidgetType.URL),
            Map.entry("link", WidgetType.URL),
            Map.entry("网址", WidgetType.URL),
            // 金额 (7 patterns)
            Map.entry("amount", WidgetType.CURRENCY),
            Map.entry("price", WidgetType.CURRENCY),
            Map.entry("cost", WidgetType.CURRENCY),
            Map.entry("total", WidgetType.CURRENCY),
            Map.entry("金额", WidgetType.CURRENCY),
            Map.entry("价格", WidgetType.CURRENCY),
            Map.entry("费用", WidgetType.CURRENCY),
            // 百分比 (4 patterns)
            Map.entry("rate", WidgetType.PERCENTAGE),
            Map.entry("ratio", WidgetType.PERCENTAGE),
            Map.entry("percent", WidgetType.PERCENTAGE),
            Map.entry("比率", WidgetType.PERCENTAGE),
            // 日期/时间 (7 patterns)
            Map.entry("date", WidgetType.DATE),
            Map.entry("birthday", WidgetType.DATE),
            Map.entry("日期", WidgetType.DATE),
            Map.entry("生日", WidgetType.DATE),
            Map.entry("datetime", WidgetType.DATE_TIME),
            Map.entry("created_at", WidgetType.DATE_TIME),
            Map.entry("updated_at", WidgetType.DATE_TIME),
            // 时间 (2 patterns)
            Map.entry("time", WidgetType.TIME),
            Map.entry("时间", WidgetType.TIME),
            // 颜色 (2 patterns)
            Map.entry("color", WidgetType.COLOR),
            Map.entry("颜色", WidgetType.COLOR),
            // 富文本 (5 patterns)
            Map.entry("content", WidgetType.RICH_TEXT),
            Map.entry("description", WidgetType.RICH_TEXT),
            Map.entry("body", WidgetType.RICH_TEXT),
            Map.entry("内容", WidgetType.RICH_TEXT),
            Map.entry("描述", WidgetType.RICH_TEXT),
            // 文件/图片 (6 patterns)
            Map.entry("file", WidgetType.FILE_UPLOAD),
            Map.entry("attachment", WidgetType.FILE_UPLOAD),
            Map.entry("附件", WidgetType.FILE_UPLOAD),
            Map.entry("image", WidgetType.IMAGE_UPLOAD),
            Map.entry("photo", WidgetType.IMAGE_UPLOAD),
            Map.entry("avatar", WidgetType.IMAGE_UPLOAD),
            Map.entry("图片", WidgetType.IMAGE_UPLOAD),
            Map.entry("头像", WidgetType.IMAGE_UPLOAD),
            // 状态/类型 (7 patterns)
            Map.entry("status", WidgetType.SELECT),
            Map.entry("state", WidgetType.SELECT),
            Map.entry("type", WidgetType.SELECT),
            Map.entry("category", WidgetType.SELECT),
            Map.entry("级别", WidgetType.SELECT),
            Map.entry("类型", WidgetType.SELECT),
            Map.entry("分类", WidgetType.SELECT)
    );

    /**
     * 识别单个字段的最佳 WidgetType
     * 策略: 语义关键词匹配 > 数据类型匹配 (兜底)
     */
    public WidgetType recognize(FieldDescriptor field) {
        // 1. 语义关键词匹配 (字段名)
        WidgetType semantic = recognizeFromSemantic(field);
        if (semantic != null) return semantic;

        // 2. 数据类型匹配 (兜底)
        return recognizeFromDataType(field);
    }

    /**
     * 批量识别
     */
    public Map<String, WidgetType> recognizeAll(List<FieldDescriptor> fields) {
        return fields.stream()
                .collect(Collectors.toMap(
                        FieldDescriptor::getCode,
                        this::recognize,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }

    /**
     * 从字段名的语义关键词识别
     */
    private WidgetType recognizeFromSemantic(FieldDescriptor field) {
        String code = field.getCode().toLowerCase();

        // 精确匹配
        WidgetType exact = SEMANTIC_RULES.get(code);
        if (exact != null) return exact;

        // 包含匹配 (字段名包含关键词)
        for (Map.Entry<String, WidgetType> entry : SEMANTIC_RULES.entrySet()) {
            if (code.contains(entry.getKey().toLowerCase())) {
                return entry.getValue();
            }
        }

        return null;
    }

    /**
     * 从数据类型推断 WidgetType
     */
    private WidgetType recognizeFromDataType(FieldDescriptor field) {
        if (field.getDataType() == null) return WidgetType.TEXT;

        return switch (field.getDataType()) {
            case STRING -> {
                if (field.getMaxLength() != null && field.getMaxLength() > 500) {
                    yield WidgetType.TEXTAREA;
                }
                yield WidgetType.TEXT;
            }
            case INTEGER, LONG, BIG_DECIMAL, DOUBLE -> WidgetType.NUMBER;
            case LOCAL_DATE -> WidgetType.DATE;
            case LOCAL_DATE_TIME, INSTANT -> WidgetType.DATE_TIME;
            case LOCAL_TIME -> WidgetType.TIME;
            case BOOLEAN -> WidgetType.CHECKBOX;
            case ENUM -> WidgetType.SELECT;
            case REFERENCE -> WidgetType.LOOKUP;
            default -> WidgetType.TEXT;
        };
    }
}
