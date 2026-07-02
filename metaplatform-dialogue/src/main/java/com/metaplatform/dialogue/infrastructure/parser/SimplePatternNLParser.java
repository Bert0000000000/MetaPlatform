package com.metaplatform.dialogue.infrastructure.parser;

import com.metaplatform.dialogue.application.NaturalLanguageParser;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * v0.1 基于模式匹配的自然语言解析器。
 * 使用关键词匹配和正则表达式识别用户意图。
 * Phase 2 将接入 LLM 进行更智能的意图识别。
 */
@Component
public class SimplePatternNLParser implements NaturalLanguageParser {

    /**
     * 意图模式定义：每个模式包含关键词集合、对应类别和提取参数的正则。
     */
    private record IntentPattern(String name, IntentCategory category,
                                  String[] keywords, Pattern paramPattern) {}

    private final IntentPattern[] patterns = {
        new IntentPattern("query_objects", IntentCategory.QUERY,
                new String[]{"查询", "查找", "搜索", "列出", "显示", "查看", "list", "query", "search", "find", "show"},
                Pattern.compile("(?:查询|查找|搜索|列出|显示|查看|list|query|search|find|show)\\s*(?:所有|全部)?\\s*(\\S+)")),
        new IntentPattern("create_object", IntentCategory.CREATE,
                new String[]{"创建", "新建", "添加", "新增", "create", "add", "new"},
                Pattern.compile("(?:创建|新建|添加|新增|create|add|new)\\s*(?:一个)?\\s*(\\S+)")),
        new IntentPattern("update_object", IntentCategory.UPDATE,
                new String[]{"更新", "修改", "编辑", "update", "edit", "modify"},
                Pattern.compile("(?:更新|修改|编辑|update|edit|modify)\\s*(\\S+)")),
        new IntentPattern("delete_object", IntentCategory.DELETE,
                new String[]{"删除", "移除", "去掉", "delete", "remove"},
                Pattern.compile("(?:删除|移除|去掉|delete|remove)\\s*(\\S+)")),
        new IntentPattern("export_data", IntentCategory.EXPORT,
                new String[]{"导出", "下载", "export", "download"},
                Pattern.compile("(?:导出|下载|export|download)\\s*(\\S+)")),
        new IntentPattern("import_data", IntentCategory.IMPORT,
                new String[]{"导入", "上传", "import", "upload"},
                Pattern.compile("(?:导入|上传|import|upload)\\s*(\\S+)")),
        new IntentPattern("help", IntentCategory.HELP,
                new String[]{"帮助", "怎么", "如何", "教程", "help", "how"},
                null),
        new IntentPattern("confirm", IntentCategory.CONFIRM,
                new String[]{"确认", "是的", "对", "好的", "ok", "yes", "confirm", "sure"},
                null),
        new IntentPattern("cancel", IntentCategory.CANCEL,
                new String[]{"取消", "算了", "不要", "cancel", "no", "abort"},
                null),
    };

    @Override
    public Intent parse(String text) {
        if (text == null || text.isBlank()) {
            return Intent.create("empty_input", IntentCategory.UNKNOWN, 0.0, null, text);
        }

        String normalized = text.trim().toLowerCase();

        for (IntentPattern pattern : patterns) {
            for (String keyword : pattern.keywords()) {
                if (normalized.contains(keyword)) {
                    Map<String, String> params = extractParameters(pattern, text);
                    double confidence = calculateConfidence(normalized, keyword);
                    return Intent.create(pattern.name(), pattern.category(),
                            confidence, params, text);
                }
            }
        }

        // 未匹配任何已知意图
        return Intent.create("unknown", IntentCategory.UNKNOWN, 0.1, null, text);
    }

    private Map<String, String> extractParameters(IntentPattern pattern, String text) {
        Map<String, String> params = new HashMap<>();
        if (pattern.paramPattern() != null) {
            Matcher matcher = pattern.paramPattern().matcher(text);
            if (matcher.find()) {
                params.put("target", matcher.group(1));
            }
        }
        return params;
    }

    private double calculateConfidence(String text, String keyword) {
        // 短文本中精确匹配关键词 => 较高置信度
        // 包含更多无关词 => 较低置信度
        int textLength = text.length();
        int keywordLength = keyword.length();
        double lengthRatio = (double) keywordLength / textLength;
        // 基础置信度 0.7 + 基于关键词占比的加分
        return Math.min(1.0, 0.7 + lengthRatio * 0.3);
    }
}
