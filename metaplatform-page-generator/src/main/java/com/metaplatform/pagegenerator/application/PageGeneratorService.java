package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import com.metaplatform.pagegenerator.infrastructure.client.ObjectTypeClient;
import com.metaplatform.pagegenerator.infrastructure.exception.PageGenerationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 页面生成服务 - 从 ObjectType Schema 自动生成 TABLE/FORM/KANBAN/PAGE
 */
@Service
public class PageGeneratorService {

    private final FieldSemanticRecognizer fieldRecognizer;
    private final LayoutOptimizer layoutOptimizer;
    private final PageConfigRepository pageConfigRepository;
    private final ObjectTypeClient objectTypeClient;

    public PageGeneratorService(FieldSemanticRecognizer fieldRecognizer,
                                 LayoutOptimizer layoutOptimizer,
                                 PageConfigRepository pageConfigRepository,
                                 ObjectTypeClient objectTypeClient) {
        this.fieldRecognizer = fieldRecognizer;
        this.layoutOptimizer = layoutOptimizer;
        this.pageConfigRepository = pageConfigRepository;
        this.objectTypeClient = objectTypeClient;
    }

    /**
     * 根据 Schema 生成页面配置
     */
    public PageConfig generate(String objectCode, PageType pageType, GenerateOptions options) {
        ObjectMeta objectMeta = objectTypeClient.getByCode(objectCode);
        if (objectMeta == null) {
            throw new PageGenerationException("ObjectType not found: " + objectCode);
        }

        List<FieldDescriptor> fields = objectMeta.getFields();
        Map<String, WidgetType> widgetMap = fieldRecognizer.recognizeAll(fields);

        return switch (pageType) {
            case TABLE -> generateTablePage(objectMeta, widgetMap, options);
            case FORM -> generateFormPage(objectMeta, widgetMap, options);
            case KANBAN -> generateKanbanPage(objectMeta, widgetMap, options);
            case PAGE -> generateDetailPage(objectMeta, widgetMap, options);
        };
    }

    /**
     * 保存生成的配置
     */
    public PageConfig save(PageConfig config) {
        config.setUpdatedAt(java.time.LocalDateTime.now());
        if (config.getCreatedAt() == null) {
            config.setCreatedAt(java.time.LocalDateTime.now());
        }
        return pageConfigRepository.save(config);
    }

    private PageConfig generateTablePage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                          GenerateOptions options) {
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 列表");
        config.setCode(meta.getCode() + "_list");
        config.setPageType(PageType.TABLE);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        PageSection tableSection = new PageSection();
        tableSection.setTitle(meta.getLabel());
        tableSection.setSectionType(SectionType.TABLE);
        tableSection.setSortOrder(0);

        TableConfig tableConfig = new TableConfig();
        tableConfig.setPagination(true);
        tableConfig.setPageSize(20);
        tableConfig.setSortable(true);
        tableConfig.setFilterable(true);
        tableConfig.setSelectable(true);
        tableConfig.setExportable(true);
        tableSection.setTableConfig(tableConfig);

        int order = 0;
        for (FieldDescriptor field : meta.getFields()) {
            if (field.isHidden()) continue;
            FieldWidget widget = new FieldWidget();
            widget.setFieldCode(field.getCode());
            widget.setLabel(field.getLabel());
            widget.setWidgetType(widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT));
            widget.setSortOrder(order++);
            tableSection.getFields().add(widget);
        }

        config.getSections().add(tableSection);

        ViewConfig viewConfig = new ViewConfig();
        viewConfig.setShowHeader(true);
        viewConfig.setShowBreadcrumb(true);
        viewConfig.setDefaultPageSize(20);
        viewConfig.setActionButtons("[{\"key\":\"create\",\"label\":\"新建\",\"type\":\"primary\"}," +
                "{\"key\":\"batchDelete\",\"label\":\"批量删除\",\"type\":\"danger\"}]");
        config.setViewConfig(viewConfig);

        layoutOptimizer.optimize(config);
        return config;
    }

    private PageConfig generateFormPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                         GenerateOptions options) {
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 表单");
        config.setCode(meta.getCode() + "_form");
        config.setPageType(PageType.FORM);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        PageSection basicSection = new PageSection();
        basicSection.setTitle("基本信息");
        basicSection.setSectionType(SectionType.FIELD_GROUP);
        basicSection.setColumns(2);
        basicSection.setSortOrder(0);

        PageSection detailSection = new PageSection();
        detailSection.setTitle("详细信息");
        detailSection.setSectionType(SectionType.FIELD_GROUP);
        detailSection.setColumns(1);
        detailSection.setSortOrder(1);

        int basicOrder = 0, detailOrder = 0;
        for (FieldDescriptor field : meta.getFields()) {
            if (field.isHidden()) continue;
            WidgetType widgetType = widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT);

            FieldWidget widget = new FieldWidget();
            widget.setFieldCode(field.getCode());
            widget.setLabel(field.getLabel());
            widget.setWidgetType(widgetType);
            widget.setRequired(field.isRequired());
            widget.setPlaceholder("请输入" + field.getLabel());

            if (widgetType == WidgetType.TEXTAREA || widgetType == WidgetType.RICH_TEXT) {
                widget.setColSpan(2);
                widget.setSortOrder(detailOrder++);
                detailSection.getFields().add(widget);
            } else {
                widget.setColSpan(1);
                widget.setSortOrder(basicOrder++);
                basicSection.getFields().add(widget);
            }
        }

        config.getSections().add(basicSection);
        if (!detailSection.getFields().isEmpty()) {
            config.getSections().add(detailSection);
        }

        return config;
    }

    private PageConfig generateKanbanPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                           GenerateOptions options) {
        String groupByField = meta.getFields().stream()
                .filter(f -> f.getDataType() == DataType.ENUM)
                .filter(f -> f.getCode().toLowerCase().contains("status"))
                .map(FieldDescriptor::getCode)
                .findFirst()
                .orElse(meta.getFields().stream()
                        .filter(f -> f.getDataType() == DataType.ENUM)
                        .map(FieldDescriptor::getCode)
                        .findFirst()
                        .orElseThrow(() -> new PageGenerationException(
                                "Kanban 页面需要至少一个枚举字段作为分组依据")));

        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 看板");
        config.setCode(meta.getCode() + "_kanban");
        config.setPageType(PageType.KANBAN);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        PageSection kanbanSection = new PageSection();
        kanbanSection.setTitle(meta.getLabel());
        kanbanSection.setSectionType(SectionType.KANBAN);
        kanbanSection.setSortOrder(0);

        KanbanConfig kanbanConfig = new KanbanConfig();
        kanbanConfig.setGroupByField(groupByField);

        String titleField = meta.getFields().stream()
                .filter(f -> f.getCode().matches("name|title|label"))
                .map(FieldDescriptor::getCode)
                .findFirst()
                .orElse(meta.getFields().stream()
                        .filter(f -> f.getDataType() == DataType.STRING)
                        .filter(f -> !f.getCode().equals(groupByField))
                        .map(FieldDescriptor::getCode)
                        .findFirst()
                        .orElse("id"));
        kanbanConfig.setTitleField(titleField);
        kanbanSection.setKanbanConfig(kanbanConfig);

        config.getSections().add(kanbanSection);
        return config;
    }

    private PageConfig generateDetailPage(ObjectMeta meta, Map<String, WidgetType> widgetMap,
                                           GenerateOptions options) {
        PageConfig config = new PageConfig();
        config.setName(meta.getLabel() + " 详情");
        config.setCode(meta.getCode() + "_detail");
        config.setPageType(PageType.PAGE);
        config.setObjectCode(meta.getCode());
        config.setStatus(ConfigStatus.DRAFT);

        List<PageSection> sections = layoutOptimizer.groupFieldsIntoSections(
                meta.getFields(), widgetMap, 2);

        int order = 0;
        for (PageSection section : sections) {
            section.setSortOrder(order++);
        }
        config.getSections().addAll(sections);

        return config;
    }
}
