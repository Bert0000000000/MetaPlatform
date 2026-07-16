package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.DataType;
import com.metaplatform.pagegenerator.domain.enums.SectionType;
import com.metaplatform.pagegenerator.domain.enums.WidgetType;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * 布局优化器 - 智能排列字段顺序和分组
 * 规则:
 * - textarea/rich_text/file_upload 占满整行
 * - required 字段排前面
 * - 按语义相关性分组 (联系方式/地址/财务/时间)
 * - 高频字段 (name/title/status) 优先
 */
@Service
public class LayoutOptimizer {

    /**
     * 优化现有 PageConfig 的布局
     */
    public void optimize(PageConfig config) {
        for (PageSection section : config.getSections()) {
            if (section.getSectionType() == SectionType.FIELD_GROUP) {
                optimizeFieldGroup(section);
            } else if (section.getSectionType() == SectionType.TABLE) {
                optimizeTableLayout(section);
            }
        }
        prioritizeFrequentFields(config);
    }

    /**
     * 将扁平字段列表智能分组为多个区块
     */
    public List<PageSection> groupFieldsIntoSections(
            List<FieldDescriptor> fields,
            Map<String, WidgetType> widgetMap,
            int defaultColumns) {

        Map<String, List<FieldDescriptor>> groups = clusterFields(fields);
        List<PageSection> sections = new ArrayList<>();

        int order = 0;
        for (Map.Entry<String, List<FieldDescriptor>> entry : groups.entrySet()) {
            PageSection section = new PageSection();
            section.setTitle(entry.getKey());
            section.setSectionType(SectionType.FIELD_GROUP);
            section.setColumns(defaultColumns);
            section.setSortOrder(order++);

            int fieldOrder = 0;
            for (FieldDescriptor field : entry.getValue()) {
                WidgetType widgetType = widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT);

                FieldWidget widget = new FieldWidget();
                widget.setFieldCode(field.getCode());
                widget.setLabel(field.getLabel());
                widget.setWidgetType(widgetType);
                widget.setRequired(field.isRequired());
                widget.setColSpan(calculateColSpan(widgetType, defaultColumns));
                widget.setSortOrder(fieldOrder++);
                section.getFields().add(widget);
            }

            sections.add(section);
        }

        return sections;
    }

    /**
     * 优化 FIELD_GROUP 区块
     */
    private void optimizeFieldGroup(PageSection section) {
        int maxCols = section.getColumns() != null ? section.getColumns() : 2;

        for (FieldWidget field : section.getFields()) {
            // textarea/rich_text/file_upload 占满整行
            field.setColSpan(calculateColSpan(field.getWidgetType(), maxCols));
        }

        // required 字段排前面
        section.getFields().sort(Comparator.comparingInt(f -> Boolean.TRUE.equals(f.getRequired()) ? 0 : 1));
    }

    /**
     * 优化表格布局
     */
    private void optimizeTableLayout(PageSection section) {
        // 表格列默认使用 1 列宽
        for (FieldWidget field : section.getFields()) {
            field.setColSpan(1);
        }
    }

    /**
     * 高频字段优先排列
     */
    private void prioritizeFrequentFields(PageConfig config) {
        for (PageSection section : config.getSections()) {
            section.getFields().sort(Comparator.comparingInt(f -> {
                String code = f.getFieldCode().toLowerCase();
                if (code.matches(".*(name|title|code).*")) return 0;
                if (code.matches(".*(status|type|category).*")) return 1;
                if (Boolean.TRUE.equals(f.getRequired())) return 2;
                return 3;
            }));
        }
    }

    /**
     * 字段聚类: 按语义相关性分组
     */
    private Map<String, List<FieldDescriptor>> clusterFields(List<FieldDescriptor> fields) {
        Map<String, List<FieldDescriptor>> groups = new LinkedHashMap<>();

        List<FieldDescriptor> basicInfo = new ArrayList<>();
        List<FieldDescriptor> contactInfo = new ArrayList<>();
        List<FieldDescriptor> addressInfo = new ArrayList<>();
        List<FieldDescriptor> financialInfo = new ArrayList<>();
        List<FieldDescriptor> datetimeInfo = new ArrayList<>();
        List<FieldDescriptor> otherInfo = new ArrayList<>();

        for (FieldDescriptor field : fields) {
            if (field.isHidden()) continue;
            String code = field.getCode().toLowerCase();

            if (matchesPattern(code, ".*(email|phone|tel|mobile|fax|wechat).*")) {
                contactInfo.add(field);
            } else if (matchesPattern(code, ".*(address|city|province|country|zip|postal).*")) {
                addressInfo.add(field);
            } else if (matchesPattern(code, ".*(amount|price|cost|total|balance|fee|budget).*")) {
                financialInfo.add(field);
            } else if (matchesPattern(code, ".*(date|time|created|updated|deleted).*")) {
                datetimeInfo.add(field);
            } else if (matchesPattern(code, ".*(name|title|code|type|status|id|no|number).*")) {
                basicInfo.add(field);
            } else {
                otherInfo.add(field);
            }
        }

        if (!basicInfo.isEmpty()) groups.put("基本信息", basicInfo);
        if (!contactInfo.isEmpty()) groups.put("联系方式", contactInfo);
        if (!addressInfo.isEmpty()) groups.put("地址信息", addressInfo);
        if (!financialInfo.isEmpty()) groups.put("财务信息", financialInfo);
        if (!datetimeInfo.isEmpty()) groups.put("时间信息", datetimeInfo);
        if (!otherInfo.isEmpty()) groups.put("其他信息", otherInfo);

        return groups;
    }

    /**
     * 根据组件类型计算跨列数
     */
    private int calculateColSpan(WidgetType widgetType, int maxColumns) {
        return switch (widgetType) {
            case TEXTAREA, RICH_TEXT, FILE_UPLOAD, IMAGE_UPLOAD -> maxColumns;
            case DIVIDER, SECTION_HEADER -> maxColumns;
            default -> 1;
        };
    }

    /**
     * 安全的正则匹配
     */
    private boolean matchesPattern(String input, String pattern) {
        return Pattern.matches(pattern, input);
    }
}
