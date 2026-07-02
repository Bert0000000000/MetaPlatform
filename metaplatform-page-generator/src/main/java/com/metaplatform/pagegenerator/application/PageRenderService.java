package com.metaplatform.pagegenerator.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.SectionType;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * 页面渲染服务 - 将 PageConfig 转换为前端渲染引擎所需的标准化 JSON
 */
@Service
public class PageRenderService {

    private final ObjectMapper objectMapper;

    public PageRenderService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 渲染页面配置为前端 JSON
     */
    public JsonNode render(PageConfig pageConfig, DataContext dataContext) {
        ObjectNode root = objectMapper.createObjectNode();

        root.put("pageType", pageConfig.getPageType().name());
        root.put("name", pageConfig.getName());
        root.put("code", pageConfig.getCode());
        root.put("objectCode", pageConfig.getObjectCode());

        // 视图配置
        if (pageConfig.getViewConfig() != null) {
            root.set("viewConfig", renderViewConfig(pageConfig.getViewConfig()));
        }

        // 区块数组
        ArrayNode sectionsArray = root.putArray("sections");
        for (PageSection section : pageConfig.getSections()) {
            sectionsArray.add(renderSection(section, dataContext));
        }

        // 元数据
        ObjectNode meta = root.putObject("_meta");
        meta.put("version", "0.1");
        meta.put("generatedAt", Instant.now().toString());
        meta.put("renderer", "PageRenderService");

        return root;
    }

    private JsonNode renderViewConfig(ViewConfig vc) {
        ObjectNode node = objectMapper.createObjectNode();
        if (vc.getShowHeader() != null) node.put("showHeader", vc.getShowHeader());
        if (vc.getShowBreadcrumb() != null) node.put("showBreadcrumb", vc.getShowBreadcrumb());
        if (vc.getDefaultPageSize() != null) node.put("defaultPageSize", vc.getDefaultPageSize());
        if (vc.getFilters() != null) node.set("filters", parseJson(vc.getFilters()));
        if (vc.getSortRules() != null) node.set("sortRules", parseJson(vc.getSortRules()));
        if (vc.getActionButtons() != null) node.set("actionButtons", parseJson(vc.getActionButtons()));
        return node;
    }

    private JsonNode renderSection(PageSection section, DataContext dataContext) {
        ObjectNode sectionNode = objectMapper.createObjectNode();
        sectionNode.put("id", section.getId());
        sectionNode.put("title", section.getTitle());
        sectionNode.put("type", section.getSectionType().name());
        sectionNode.put("columns", section.getColumns());

        switch (section.getSectionType()) {
            case FIELD_GROUP -> renderFieldGroup(section, sectionNode, dataContext);
            case TABLE -> renderTableSection(section, sectionNode);
            case KANBAN -> renderKanbanSection(section, sectionNode);
            default -> {} // RICH_TEXT, CHART - no-op for v0.1
        }

        return sectionNode;
    }

    private void renderFieldGroup(PageSection section, ObjectNode node, DataContext ctx) {
        ArrayNode fieldsArray = node.putArray("fields");
        for (FieldWidget widget : section.getFields()) {
            ObjectNode fieldNode = objectMapper.createObjectNode();
            fieldNode.put("fieldCode", widget.getFieldCode());
            fieldNode.put("label", widget.getLabel());
            fieldNode.put("widgetType", widget.getWidgetType().name());
            fieldNode.put("required", Boolean.TRUE.equals(widget.getRequired()));
            fieldNode.put("readonly", Boolean.TRUE.equals(widget.getReadonly()));
            fieldNode.put("colSpan", widget.getColSpan());

            if (widget.getPlaceholder() != null) {
                fieldNode.put("placeholder", widget.getPlaceholder());
            }
            if (widget.getOptions() != null) {
                fieldNode.set("options", parseJson(widget.getOptions()));
            }
            if (widget.getValidationRules() != null) {
                fieldNode.set("validation", parseJson(widget.getValidationRules()));
            }

            // 注入当前值
            if (ctx != null && ctx.hasValue(widget.getFieldCode())) {
                fieldNode.set("value", ctx.getValue(widget.getFieldCode()));
            }

            fieldsArray.add(fieldNode);
        }
    }

    private void renderTableSection(PageSection section, ObjectNode node) {
        ObjectNode tableNode = node.putObject("table");
        TableConfig tc = section.getTableConfig();

        if (tc != null) {
            tableNode.put("pagination", Boolean.TRUE.equals(tc.getPagination()));
            tableNode.put("pageSize", tc.getPageSize() != null ? tc.getPageSize() : 20);
            tableNode.put("sortable", Boolean.TRUE.equals(tc.getSortable()));
            tableNode.put("filterable", Boolean.TRUE.equals(tc.getFilterable()));
        }

        ArrayNode columns = tableNode.putArray("columns");
        for (FieldWidget widget : section.getFields()) {
            ObjectNode col = objectMapper.createObjectNode();
            col.put("field", widget.getFieldCode());
            col.put("headerName", widget.getLabel());
            col.put("type", widget.getWidgetType().name());
            columns.add(col);
        }
    }

    private void renderKanbanSection(PageSection section, ObjectNode node) {
        ObjectNode kanbanNode = node.putObject("kanban");
        KanbanConfig kc = section.getKanbanConfig();

        if (kc != null) {
            kanbanNode.put("groupBy", kc.getGroupByField());
            kanbanNode.put("titleField", kc.getTitleField());
            if (kc.getDescriptionField() != null) {
                kanbanNode.put("descriptionField", kc.getDescriptionField());
            }
        }
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.getNodeFactory().textNode(json);
        }
    }
}
