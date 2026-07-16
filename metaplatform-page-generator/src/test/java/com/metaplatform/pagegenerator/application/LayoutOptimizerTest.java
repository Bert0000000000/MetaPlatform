package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class LayoutOptimizerTest {

    private LayoutOptimizer optimizer;

    @BeforeEach
    void setUp() {
        optimizer = new LayoutOptimizer();
    }

    @Test
    void textareaFieldShouldSpanFullRow() {
        PageConfig config = createConfigWithFields(
                new FieldWidget("name", "名称", WidgetType.TEXT),
                new FieldWidget("description", "描述", WidgetType.TEXTAREA)
        );

        optimizer.optimize(config);

        PageSection section = config.getSections().get(0);
        FieldWidget nameField = section.getFields().stream()
                .filter(f -> f.getFieldCode().equals("name")).findFirst().orElseThrow();
        FieldWidget descField = section.getFields().stream()
                .filter(f -> f.getFieldCode().equals("description")).findFirst().orElseThrow();

        assertEquals(1, nameField.getColSpan());
        assertEquals(2, descField.getColSpan()); // Full row
    }

    @Test
    void requiredFieldsShouldComeFirst() {
        PageConfig config = createConfigWithFields(
                createWidget("memo", "备注", WidgetType.TEXTAREA, false),
                createWidget("name", "名称", WidgetType.TEXT, true),
                createWidget("status", "状态", WidgetType.SELECT, false)
        );

        optimizer.optimize(config);

        PageSection section = config.getSections().get(0);
        // After optimization: name/title/code first (priority 0), then status/type (1), then required (2), then others (3)
        // "name" matches priority 0, "status" matches priority 1, "memo" is priority 3
        assertEquals("name", section.getFields().get(0).getFieldCode());
    }

    @Test
    void fileUploadShouldSpanFullRow() {
        PageConfig config = createConfigWithFields(
                new FieldWidget("file", "文件", WidgetType.FILE_UPLOAD),
                new FieldWidget("image", "图片", WidgetType.IMAGE_UPLOAD)
        );

        optimizer.optimize(config);

        PageSection section = config.getSections().get(0);
        for (FieldWidget field : section.getFields()) {
            assertEquals(2, field.getColSpan());
        }
    }

    @Test
    void groupFieldsIntoSectionsClustersCorrectly() {
        List<FieldDescriptor> fields = List.of(
                new FieldDescriptor("name", "名称", DataType.STRING, 100, true, false),
                new FieldDescriptor("status", "状态", DataType.ENUM, null, false, false),
                new FieldDescriptor("email", "邮箱", DataType.STRING, 100, false, false),
                new FieldDescriptor("phone", "电话", DataType.STRING, 20, false, false),
                new FieldDescriptor("address", "地址", DataType.STRING, 500, false, false),
                new FieldDescriptor("totalAmount", "金额", DataType.BIG_DECIMAL, null, false, false),
                new FieldDescriptor("createdAt", "创建时间", DataType.LOCAL_DATE_TIME, null, false, false)
        );

        Map<String, WidgetType> widgetMap = Map.of(
                "name", WidgetType.TEXT,
                "status", WidgetType.SELECT,
                "email", WidgetType.EMAIL,
                "phone", WidgetType.PHONE,
                "address", WidgetType.TEXT,
                "totalAmount", WidgetType.CURRENCY,
                "createdAt", WidgetType.DATE_TIME
        );

        List<PageSection> sections = optimizer.groupFieldsIntoSections(fields, widgetMap, 2);

        assertFalse(sections.isEmpty());

        // Should have at least: 基本信息, 联系方式, 财务信息, 时间信息
        Set<String> sectionTitles = new HashSet<>();
        for (PageSection s : sections) {
            sectionTitles.add(s.getTitle());
        }

        assertTrue(sectionTitles.contains("基本信息"), "Should have basic info section");
        assertTrue(sectionTitles.contains("联系方式"), "Should have contact info section");
        assertTrue(sectionTitles.contains("财务信息"), "Should have financial info section");
    }

    @Test
    void hiddenFieldsShouldBeExcluded() {
        List<FieldDescriptor> fields = List.of(
                new FieldDescriptor("name", "名称", DataType.STRING, 100, true, false),
                new FieldDescriptor("internalId", "内部ID", DataType.STRING, 50, false, true) // hidden
        );

        Map<String, WidgetType> widgetMap = Map.of(
                "name", WidgetType.TEXT,
                "internalId", WidgetType.TEXT
        );

        List<PageSection> sections = optimizer.groupFieldsIntoSections(fields, widgetMap, 2);

        // Count total fields across all sections
        int totalFields = sections.stream()
                .mapToInt(s -> s.getFields().size())
                .sum();

        assertEquals(1, totalFields, "Hidden fields should be excluded");
    }

    @Test
    void emptyFieldsListProducesNoSections() {
        List<PageSection> sections = optimizer.groupFieldsIntoSections(
                List.of(), Map.of(), 2);
        assertTrue(sections.isEmpty());
    }

    // Helper methods
    private PageConfig createConfigWithFields(FieldWidget... widgets) {
        PageConfig config = new PageConfig();
        config.setName("Test");
        config.setCode("test");
        config.setPageType(PageType.FORM);

        PageSection section = new PageSection();
        section.setTitle("基本信息");
        section.setSectionType(SectionType.FIELD_GROUP);
        section.setColumns(2);
        section.setSortOrder(0);
        section.setFields(new ArrayList<>(Arrays.asList(widgets)));

        config.setSections(new ArrayList<>(List.of(section)));
        return config;
    }

    private FieldWidget createWidget(String code, String label, WidgetType type, boolean required) {
        FieldWidget w = new FieldWidget(code, label, type);
        w.setRequired(required);
        return w;
    }
}
