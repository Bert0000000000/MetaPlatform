package com.metaplatform.pagegenerator.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import com.metaplatform.pagegenerator.infrastructure.client.LlmClient;
import com.metaplatform.pagegenerator.infrastructure.client.ObjectTypeClient;
import com.metaplatform.pagegenerator.infrastructure.exception.NlGenerationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 自然语言页面生成器 - 通过 AI Substrate LLM 从自然语言描述生成 PageConfig
 */
@Service
public class NlPageGenerator {

    private static final Logger log = LoggerFactory.getLogger(NlPageGenerator.class);

    private final LlmClient llmClient;
    private final ObjectTypeClient objectTypeClient;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = """
        你是 MetaPlatform 的页面配置生成器。根据用户的自然语言描述，
        生成 PageConfig 的 JSON 配置。

        输出必须是合法的 JSON，包含以下字段:
        - name: 页面名称
        - pageType: TABLE | FORM | KANBAN | PAGE
        - objectCode: 关联对象编码 (如有)
        - sections: 数组，每个元素包含:
          - title: 区块标题
          - sectionType: FIELD_GROUP | TABLE | KANBAN
          - columns: 栅格列数
          - fields: 数组，每个元素包含:
            - fieldCode: 字段编码
            - label: 显示标签
            - widgetType: 组件类型
            - required: 是否必填
            - placeholder: 占位文本

        示例输入: "创建一个客户管理的列表页面，显示姓名、电话、邮箱、状态"
        示例输出:
        {
          "name": "客户列表",
          "pageType": "TABLE",
          "objectCode": "customer",
          "sections": [{
            "title": "客户列表",
            "sectionType": "TABLE",
            "fields": [
              {"fieldCode": "name", "label": "姓名", "widgetType": "TEXT"},
              {"fieldCode": "phone", "label": "电话", "widgetType": "PHONE"},
              {"fieldCode": "email", "label": "邮箱", "widgetType": "EMAIL"},
              {"fieldCode": "status", "label": "状态", "widgetType": "SELECT"}
            ]
          }]
        }
        """;

    public NlPageGenerator(LlmClient llmClient,
                            ObjectTypeClient objectTypeClient,
                            ObjectMapper objectMapper) {
        this.llmClient = llmClient;
        this.objectTypeClient = objectTypeClient;
        this.objectMapper = objectMapper;
    }

    /**
     * 自然语言生成页面配置
     */
    public PageConfig generate(String description, String objectCode) {
        try {
            String userPrompt = buildUserPrompt(description, objectCode);
            String response = llmClient.chatCompletion(
                    SYSTEM_PROMPT, userPrompt, "gpt-4o", 0.3);

            PageConfig config = parseResponse(response);
            config.setStatus(ConfigStatus.DRAFT);
            config.setCreatedBy("nl_generator");
            return config;
        } catch (NlGenerationException e) {
            throw e;
        } catch (Exception e) {
            log.error("NL generation failed: {}", e.getMessage());
            throw new NlGenerationException("自然语言生成失败: " + e.getMessage(), e);
        }
    }

    private String buildUserPrompt(String description, String objectCode) {
        StringBuilder sb = new StringBuilder();
        sb.append("请根据以下描述生成页面配置:\n\n");
        sb.append(description);
        if (objectCode != null) {
            sb.append("\n\n关联对象编码: ").append(objectCode);
            ObjectMeta meta = objectTypeClient.getByCode(objectCode);
            if (meta != null) {
                sb.append("\n\n可用字段:\n");
                for (FieldDescriptor f : meta.getFields()) {
                    sb.append("- ").append(f.getCode())
                            .append(" (").append(f.getLabel())
                            .append(", ").append(f.getDataType()).append(")\n");
                }
            }
        }
        return sb.toString();
    }

    private PageConfig parseResponse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            PageConfig config = new PageConfig();
            config.setName(root.get("name").asText());
            config.setPageType(PageType.valueOf(root.get("pageType").asText()));
            config.setCode(generateCode(config.getName()));

            if (root.has("objectCode")) {
                config.setObjectCode(root.get("objectCode").asText());
            }

            if (root.has("sections")) {
                int sectionOrder = 0;
                for (JsonNode sectionNode : root.get("sections")) {
                    PageSection section = parseSection(sectionNode, sectionOrder++);
                    config.getSections().add(section);
                }
            }

            return config;
        } catch (Exception e) {
            throw new NlGenerationException("无法解析 LLM 返回的 JSON: " + e.getMessage(), e);
        }
    }

    private PageSection parseSection(JsonNode node, int order) {
        PageSection section = new PageSection();
        section.setTitle(node.get("title").asText());
        section.setSectionType(SectionType.valueOf(node.get("sectionType").asText()));
        section.setSortOrder(order);
        section.setColumns(node.has("columns") ? node.get("columns").asInt() : 2);

        if (node.has("fields")) {
            int fieldOrder = 0;
            for (JsonNode fieldNode : node.get("fields")) {
                FieldWidget widget = new FieldWidget();
                widget.setFieldCode(fieldNode.get("fieldCode").asText());
                widget.setLabel(fieldNode.get("label").asText());
                widget.setWidgetType(WidgetType.valueOf(fieldNode.get("widgetType").asText()));
                widget.setRequired(fieldNode.has("required") &&
                        fieldNode.get("required").asBoolean());
                widget.setPlaceholder(fieldNode.has("placeholder") ?
                        fieldNode.get("placeholder").asText() : null);
                widget.setSortOrder(fieldOrder++);
                section.getFields().add(widget);
            }
        }

        return section;
    }

    private String generateCode(String name) {
        return name.replaceAll("[^a-zA-Z0-9\\u4e00-\\u9fa5]", "_").toLowerCase()
                + "_" + UUID.randomUUID().toString().substring(0, 8);
    }
}
