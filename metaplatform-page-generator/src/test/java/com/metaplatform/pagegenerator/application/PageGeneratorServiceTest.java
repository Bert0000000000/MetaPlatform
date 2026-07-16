package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import com.metaplatform.pagegenerator.infrastructure.client.ObjectTypeClient;
import com.metaplatform.pagegenerator.infrastructure.exception.PageGenerationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PageGeneratorServiceTest {

    @Mock
    private PageConfigRepository pageConfigRepository;

    private PageGeneratorService service;
    private FieldSemanticRecognizer fieldRecognizer;
    private LayoutOptimizer layoutOptimizer;
    private ObjectTypeClient objectTypeClient;

    @BeforeEach
    void setUp() {
        fieldRecognizer = new FieldSemanticRecognizer();
        layoutOptimizer = new LayoutOptimizer();
        // Use real ObjectTypeClient with builtin samples
        objectTypeClient = new ObjectTypeClient(null, "http://localhost:8081");
        service = new PageGeneratorService(fieldRecognizer, layoutOptimizer,
                pageConfigRepository, objectTypeClient);
    }

    @Test
    void generateTablePage() {
        PageConfig config = service.generate("customer", PageType.TABLE, new GenerateOptions());

        assertNotNull(config);
        assertEquals(PageType.TABLE, config.getPageType());
        assertEquals("customer_list", config.getCode());
        assertEquals(ConfigStatus.DRAFT, config.getStatus());
        assertFalse(config.getSections().isEmpty());

        PageSection tableSection = config.getSections().get(0);
        assertEquals(SectionType.TABLE, tableSection.getSectionType());
        assertNotNull(tableSection.getTableConfig());
        assertTrue(tableSection.getTableConfig().getPagination());
        assertFalse(tableSection.getFields().isEmpty());

        // Verify email field is recognized as EMAIL widget
        boolean hasEmailWidget = tableSection.getFields().stream()
                .anyMatch(f -> f.getFieldCode().equals("email") &&
                        f.getWidgetType() == WidgetType.EMAIL);
        assertTrue(hasEmailWidget, "Email field should be mapped to EMAIL widget");
    }

    @Test
    void generateFormPage() {
        PageConfig config = service.generate("customer", PageType.FORM, new GenerateOptions());

        assertNotNull(config);
        assertEquals(PageType.FORM, config.getPageType());
        assertEquals("customer_form", config.getCode());
        assertFalse(config.getSections().isEmpty());

        // Should have basic and detail sections
        assertTrue(config.getSections().size() >= 1);
        assertEquals(SectionType.FIELD_GROUP, config.getSections().get(0).getSectionType());

        // Verify description field goes to detail section (TEXTAREA)
        boolean hasDetailSection = config.getSections().stream()
                .anyMatch(s -> s.getTitle().equals("详细信息"));
        assertTrue(hasDetailSection, "Should have detail section for textarea fields");
    }

    @Test
    void generateKanbanPage() {
        PageConfig config = service.generate("order", PageType.KANBAN, new GenerateOptions());

        assertNotNull(config);
        assertEquals(PageType.KANBAN, config.getPageType());
        assertEquals("order_kanban", config.getCode());
        assertFalse(config.getSections().isEmpty());

        PageSection kanbanSection = config.getSections().get(0);
        assertEquals(SectionType.KANBAN, kanbanSection.getSectionType());
        assertNotNull(kanbanSection.getKanbanConfig());
        assertEquals("status", kanbanSection.getKanbanConfig().getGroupByField());
    }

    @Test
    void generateDetailPage() {
        PageConfig config = service.generate("customer", PageType.PAGE, new GenerateOptions());

        assertNotNull(config);
        assertEquals(PageType.PAGE, config.getPageType());
        assertEquals("customer_detail", config.getCode());
        assertFalse(config.getSections().isEmpty());

        // Detail page should have grouped sections
        for (PageSection section : config.getSections()) {
            assertEquals(SectionType.FIELD_GROUP, section.getSectionType());
        }
    }

    @Test
    void generateWithUnknownObjectCodeUsesDefault() {
        PageConfig config = service.generate("unknown_object", PageType.TABLE, new GenerateOptions());

        assertNotNull(config);
        assertEquals(PageType.TABLE, config.getPageType());
        assertFalse(config.getSections().isEmpty());
    }

    @Test
    void saveConfig() {
        PageConfig config = new PageConfig();
        config.setName("Test");
        config.setCode("test");
        config.setPageType(PageType.TABLE);

        when(pageConfigRepository.save(any(PageConfig.class))).thenAnswer(inv -> {
            PageConfig saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        PageConfig saved = service.save(config);
        assertNotNull(saved);
        assertNotNull(saved.getCreatedAt());
    }

    @Test
    void formPageTextareaFieldsGetFullColSpan() {
        PageConfig config = service.generate("customer", PageType.FORM, new GenerateOptions());

        // description field should be in detail section with colSpan=2
        config.getSections().stream()
                .filter(s -> s.getTitle().equals("详细信息"))
                .flatMap(s -> s.getFields().stream())
                .filter(f -> f.getFieldCode().equals("description"))
                .forEach(f -> assertEquals(2, f.getColSpan()));
    }

    @Test
    void kanbanPageRequiresEnumField() {
        // product has "category" and "status" enums, should work
        PageConfig config = service.generate("product", PageType.KANBAN, new GenerateOptions());
        assertNotNull(config);
        assertNotNull(config.getSections().get(0).getKanbanConfig());
    }
}
