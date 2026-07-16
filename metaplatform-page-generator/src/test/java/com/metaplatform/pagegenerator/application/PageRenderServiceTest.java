package com.metaplatform.pagegenerator.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PageRenderServiceTest {

    private PageRenderService renderService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        renderService = new PageRenderService(objectMapper);
    }

    @Test
    void renderTablePage() {
        PageConfig config = createTablePageConfig();

        JsonNode result = renderService.render(config, null);

        assertNotNull(result);
        assertEquals("TABLE", result.get("pageType").asText());
        assertEquals("客户列表", result.get("name").asText());
        assertEquals("customer_list", result.get("code").asText());
        assertTrue(result.has("sections"));
        assertTrue(result.has("_meta"));
        assertTrue(result.has("viewConfig"));
    }

    @Test
    void renderFormFieldGroup() {
        PageConfig config = createFormPageConfig();

        JsonNode result = renderService.render(config, null);

        JsonNode sections = result.get("sections");
        assertTrue(sections.isArray());
        assertTrue(sections.size() > 0);

        JsonNode firstSection = sections.get(0);
        assertEquals("FIELD_GROUP", firstSection.get("type").asText());
        assertTrue(firstSection.has("fields"));

        JsonNode fields = firstSection.get("fields");
        assertTrue(fields.isArray());

        // Check first field has required properties
        JsonNode firstField = fields.get(0);
        assertTrue(firstField.has("fieldCode"));
        assertTrue(firstField.has("label"));
        assertTrue(firstField.has("widgetType"));
        assertTrue(firstField.has("required"));
        assertTrue(firstField.has("colSpan"));
    }

    @Test
    void renderKanbanSection() {
        PageConfig config = createKanbanPageConfig();

        JsonNode result = renderService.render(config, null);

        JsonNode sections = result.get("sections");
        JsonNode kanbanSection = sections.get(0);
        assertEquals("KANBAN", kanbanSection.get("type").asText());
        assertTrue(kanbanSection.has("kanban"));

        JsonNode kanban = kanbanSection.get("kanban");
        assertEquals("status", kanban.get("groupBy").asText());
        assertEquals("name", kanban.get("titleField").asText());
    }

    @Test
    void renderWithDataContext() {
        PageConfig config = createFormPageConfig();

        java.util.Map<String, JsonNode> values = new java.util.HashMap<>();
        values.put("name", objectMapper.valueToTree("张三"));
        values.put("email", objectMapper.valueToTree("zhangsan@example.com"));
        DataContext ctx = new DataContext(values);

        JsonNode result = renderService.render(config, ctx);

        // Find the name field in rendered output
        JsonNode fields = result.get("sections").get(0).get("fields");
        boolean foundNameWithValue = false;
        for (JsonNode field : fields) {
            if ("name".equals(field.get("fieldCode").asText()) && field.has("value")) {
                assertEquals("张三", field.get("value").asText());
                foundNameWithValue = true;
            }
        }
        assertTrue(foundNameWithValue, "Name field should have value from DataContext");
    }

    @Test
    void renderIncludesMetadata() {
        PageConfig config = createTablePageConfig();

        JsonNode result = renderService.render(config, null);

        JsonNode meta = result.get("_meta");
        assertNotNull(meta);
        assertEquals("0.1", meta.get("version").asText());
        assertEquals("PageRenderService", meta.get("renderer").asText());
        assertTrue(meta.has("generatedAt"));
    }

    @Test
    void renderTableSectionWithColumns() {
        PageConfig config = createTablePageConfig();

        JsonNode result = renderService.render(config, null);

        JsonNode tableSection = result.get("sections").get(0);
        assertTrue(tableSection.has("table"));

        JsonNode table = tableSection.get("table");
        assertTrue(table.has("columns"));
        assertTrue(table.get("columns").isArray());
        assertTrue(table.get("pagination").asBoolean());
    }

    // Helper methods
    private PageConfig createTablePageConfig() {
        PageConfig config = new PageConfig();
        config.setName("客户列表");
        config.setCode("customer_list");
        config.setPageType(PageType.TABLE);
        config.setObjectCode("customer");

        ViewConfig vc = new ViewConfig();
        vc.setShowHeader(true);
        vc.setShowBreadcrumb(true);
        vc.setDefaultPageSize(20);
        config.setViewConfig(vc);

        PageSection section = new PageSection();
        section.setTitle("客户列表");
        section.setSectionType(SectionType.TABLE);
        section.setSortOrder(0);

        TableConfig tc = new TableConfig(true, 20, true, true, true, true);
        section.setTableConfig(tc);

        section.setFields(List.of(
                new FieldWidget("name", "名称", WidgetType.TEXT),
                new FieldWidget("email", "邮箱", WidgetType.EMAIL),
                new FieldWidget("phone", "电话", WidgetType.PHONE),
                new FieldWidget("status", "状态", WidgetType.SELECT)
        ));

        config.setSections(List.of(section));
        return config;
    }

    private PageConfig createFormPageConfig() {
        PageConfig config = new PageConfig();
        config.setName("客户表单");
        config.setCode("customer_form");
        config.setPageType(PageType.FORM);
        config.setObjectCode("customer");

        PageSection section = new PageSection();
        section.setTitle("基本信息");
        section.setSectionType(SectionType.FIELD_GROUP);
        section.setColumns(2);
        section.setSortOrder(0);

        FieldWidget nameField = new FieldWidget("name", "名称", WidgetType.TEXT);
        nameField.setRequired(true);
        nameField.setPlaceholder("请输入名称");

        FieldWidget emailField = new FieldWidget("email", "邮箱", WidgetType.EMAIL);
        emailField.setRequired(true);

        section.setFields(List.of(nameField, emailField));
        config.setSections(List.of(section));
        return config;
    }

    private PageConfig createKanbanPageConfig() {
        PageConfig config = new PageConfig();
        config.setName("订单看板");
        config.setCode("order_kanban");
        config.setPageType(PageType.KANBAN);
        config.setObjectCode("order");

        PageSection section = new PageSection();
        section.setTitle("订单看板");
        section.setSectionType(SectionType.KANBAN);
        section.setSortOrder(0);

        KanbanConfig kc = new KanbanConfig();
        kc.setGroupByField("status");
        kc.setTitleField("name");
        section.setKanbanConfig(kc);

        config.setSections(List.of(section));
        return config;
    }
}
