package com.metaplatform.dialogue.infrastructure.parser;

import com.metaplatform.dialogue.application.ResponseGenerator;
import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import com.metaplatform.dialogue.domain.message.Message;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * v0.1 基于模板的回复生成器。
 * 根据意图类别选择对应的回复模板。
 * Phase 2 将接入 LLM 进行更智能的回复生成。
 */
@Component
public class TemplateResponseGenerator implements ResponseGenerator {

    private static final Map<IntentCategory, String> TEMPLATES;

    static {
        TEMPLATES = new EnumMap<>(IntentCategory.class);
        TEMPLATES.put(IntentCategory.QUERY, "好的，正在为您查询%s。请稍候...");
        TEMPLATES.put(IntentCategory.CREATE, "好的，正在为您创建%s。");
        TEMPLATES.put(IntentCategory.UPDATE, "好的，正在为您更新%s。");
        TEMPLATES.put(IntentCategory.DELETE, "确认要删除%s吗？此操作不可撤销。");
        TEMPLATES.put(IntentCategory.EXPORT, "好的，正在为您导出%s。");
        TEMPLATES.put(IntentCategory.IMPORT, "好的，请提供需要导入的%s数据。");
        TEMPLATES.put(IntentCategory.HELP, "我可以帮您查询、创建、修改和删除平台中的数据。请告诉我您需要什么帮助？");
        TEMPLATES.put(IntentCategory.CONFIRM, "好的，已确认。");
        TEMPLATES.put(IntentCategory.CANCEL, "好的，已取消当前操作。");
        TEMPLATES.put(IntentCategory.SYSTEM, "系统处理中...");
        TEMPLATES.put(IntentCategory.UNKNOWN, "抱歉，我暂时无法理解您的请求。您可以尝试：\n1. 查询 [对象类型]\n2. 创建 [对象类型]\n3. 导出 [对象类型]");
    }

    @Override
    public String generate(Conversation conversation, Intent intent, List<Message> history) {
        String template = TEMPLATES.getOrDefault(intent.category(),
                "收到您的请求，正在处理中...");

        String target = intent.parameters().getOrDefault("target", "数据");

        try {
            return String.format(template, target);
        } catch (Exception e) {
            // 模板不支持参数替换时直接返回模板
            return template;
        }
    }
}
