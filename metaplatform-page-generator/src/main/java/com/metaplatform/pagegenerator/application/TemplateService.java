package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import com.metaplatform.pagegenerator.infrastructure.client.ObjectTypeClient;
import com.metaplatform.pagegenerator.infrastructure.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 模板服务 - 提供 CRUD、主从表单、看板三种预设模板
 */
@Service
public class TemplateService {

    private final ObjectTypeClient objectTypeClient;
    private final PageGeneratorService pageGeneratorService;

    public TemplateService(ObjectTypeClient objectTypeClient,
                           PageGeneratorService pageGeneratorService) {
        this.objectTypeClient = objectTypeClient;
        this.pageGeneratorService = pageGeneratorService;
    }

    /**
     * 获取所有内置模板
     */
    public List<PageTemplate> listTemplates() {
        return List.of(
                buildCrudTemplate(),
                buildMasterDetailTemplate(),
                buildKanbanTemplate()
        );
    }

    /**
     * 根据编码获取模板
     */
    public PageTemplate getTemplate(String code) {
        return listTemplates().stream()
                .filter(t -> t.getCode().equals(code))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Template", code));
    }

    /**
     * 根据模板创建 PageConfig
     */
    public PageConfig createFromTemplate(String templateCode, String objectCode,
                                          TemplateOverrides overrides) {
        PageTemplate template = getTemplate(templateCode);
        ObjectMeta meta = objectTypeClient.getByCode(objectCode);

        String namePrefix = (overrides != null && overrides.getNamePrefix() != null)
                ? overrides.getNamePrefix() : meta.getLabel();

        return switch (templateCode) {
            case "CRUD" -> createCrudPages(namePrefix, objectCode, meta, overrides);
            case "MASTER_DETAIL" -> createMasterDetailPage(namePrefix, objectCode, meta, overrides);
            case "KANBAN" -> createKanbanPage(namePrefix, objectCode, meta, overrides);
            default -> throw new IllegalArgumentException("Unknown template: " + templateCode);
        };
    }

    private PageConfig createCrudPages(String namePrefix, String objectCode,
                                        ObjectMeta meta, TemplateOverrides overrides) {
        // CRUD 模板生成列表页
        PageConfig config = pageGeneratorService.generate(objectCode, PageType.TABLE,
                toOptions(overrides));
        config.setName(namePrefix + " 管理");
        config.setCode(objectCode + "_crud");
        return config;
    }

    private PageConfig createMasterDetailPage(String namePrefix, String objectCode,
                                               ObjectMeta meta, TemplateOverrides overrides) {
        PageConfig config = new PageConfig();
        config.setName(namePrefix + " 主从表单");
        config.setCode(objectCode + "_master_detail");
        config.setPageType(PageType.FORM);
        config.setObjectCode(objectCode);
        config.setStatus(ConfigStatus.DRAFT);

        // 主表信息区块
        PageSection masterSection = new PageSection();
        masterSection.setTitle("主表信息");
        masterSection.setSectionType(SectionType.FIELD_GROUP);
        masterSection.setColumns(2);
        masterSection.setSortOrder(0);

        // 明细行区块
        PageSection detailSection = new PageSection();
        detailSection.setTitle("明细行");
        detailSection.setSectionType(SectionType.TABLE);
        detailSection.setSortOrder(1);

        TableConfig tableConfig = new TableConfig();
        tableConfig.setPagination(false);
        detailSection.setTableConfig(tableConfig);

        // 分配字段
        FieldSemanticRecognizer recognizer = new FieldSemanticRecognizer();
        Map<String, WidgetType> widgetMap = recognizer.recognizeAll(meta.getFields());

        int masterOrder = 0;
        for (FieldDescriptor field : meta.getFields()) {
            if (field.isHidden()) continue;
            WidgetType wt = widgetMap.getOrDefault(field.getCode(), WidgetType.TEXT);

            FieldWidget widget = new FieldWidget();
            widget.setFieldCode(field.getCode());
            widget.setLabel(field.getLabel());
            widget.setWidgetType(wt);
            widget.setRequired(field.isRequired());
            widget.setPlaceholder("请输入" + field.getLabel());

            if (wt == WidgetType.TEXTAREA || wt == WidgetType.RICH_TEXT) {
                widget.setColSpan(2);
                detailSection.getFields().add(widget);
            } else {
                widget.setSortOrder(masterOrder++);
                masterSection.getFields().add(widget);
            }
        }

        config.getSections().add(masterSection);
        config.getSections().add(detailSection);

        return config;
    }

    private PageConfig createKanbanPage(String namePrefix, String objectCode,
                                         ObjectMeta meta, TemplateOverrides overrides) {
        return pageGeneratorService.generate(objectCode, PageType.KANBAN, toOptions(overrides));
    }

    private GenerateOptions toOptions(TemplateOverrides overrides) {
        GenerateOptions options = new GenerateOptions();
        if (overrides != null) {
            if (overrides.getColumns() != null) options.setColumns(overrides.getColumns());
            if (overrides.getIncludeHidden() != null) options.setIncludeHidden(overrides.getIncludeHidden());
            if (overrides.getFieldLabelOverrides() != null) options.setFieldOverrides(overrides.getFieldLabelOverrides());
        }
        return options;
    }

    private PageTemplate buildCrudTemplate() {
        return new PageTemplate(
                "CRUD",
                "标准 CRUD 页面",
                "包含列表页 + 新建/编辑表单 + 详情页的标准增删改查页面组",
                List.of(PageType.TABLE, PageType.FORM, PageType.PAGE),
                """
                {
                  "list": {
                    "pageType": "TABLE",
                    "features": ["search", "filter", "export", "batchDelete"],
                    "defaultPageSize": 20
                  },
                  "form": {
                    "pageType": "FORM",
                    "columns": 2,
                    "sections": [
                      {"title": "基本信息", "fields": ["*required"], "columns": 2},
                      {"title": "详细信息", "fields": ["*optional"], "columns": 1}
                    ]
                  },
                  "detail": {
                    "pageType": "PAGE",
                    "sections": ["*auto_grouped"]
                  }
                }
                """
        );
    }

    private PageTemplate buildMasterDetailTemplate() {
        return new PageTemplate(
                "MASTER_DETAIL",
                "主从表单",
                "主表单 + 子表表格的主从联动页面",
                List.of(PageType.FORM),
                """
                {
                  "form": {
                    "pageType": "FORM",
                    "columns": 2,
                    "sections": [
                      {"title": "主表信息", "fields": ["*master_fields"], "columns": 2},
                      {"title": "明细行", "type": "TABLE", "fields": ["*detail_fields"],
                       "features": ["inlineEdit", "addRow", "deleteRow"]}
                    ]
                  }
                }
                """
        );
    }

    private PageTemplate buildKanbanTemplate() {
        return new PageTemplate(
                "KANBAN",
                "看板页面",
                "按状态分组的看板视图，支持拖拽",
                List.of(PageType.KANBAN),
                """
                {
                  "kanban": {
                    "pageType": "KANBAN",
                    "groupBy": "auto_detect_enum_status",
                    "card": {
                      "title": "auto_detect_name",
                      "description": "auto_detect_description",
                      "avatar": "auto_detect_avatar"
                    },
                    "features": ["dragDrop", "quickFilter"]
                  }
                }
                """
        );
    }
}
