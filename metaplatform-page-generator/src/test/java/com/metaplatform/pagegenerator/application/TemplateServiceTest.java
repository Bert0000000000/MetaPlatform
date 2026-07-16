package com.metaplatform.pagegenerator.application;

import com.metaplatform.pagegenerator.domain.*;
import com.metaplatform.pagegenerator.domain.enums.*;
import com.metaplatform.pagegenerator.infrastructure.client.ObjectTypeClient;
import com.metaplatform.pagegenerator.infrastructure.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class TemplateServiceTest {

    @Mock
    private PageConfigRepository pageConfigRepository;

    private TemplateService templateService;

    @BeforeEach
    void setUp() {
        ObjectTypeClient client = new ObjectTypeClient(null, "http://localhost:8081");
        FieldSemanticRecognizer recognizer = new FieldSemanticRecognizer();
        LayoutOptimizer optimizer = new LayoutOptimizer();
        PageGeneratorService generatorService = new PageGeneratorService(
                recognizer, optimizer, pageConfigRepository, client);
        templateService = new TemplateService(client, generatorService);
    }

    @Test
    void listTemplatesReturnsThree() {
        List<PageTemplate> templates = templateService.listTemplates();

        assertEquals(3, templates.size());

        List<String> codes = templates.stream()
                .map(PageTemplate::getCode)
                .toList();
        assertTrue(codes.contains("CRUD"));
        assertTrue(codes.contains("MASTER_DETAIL"));
        assertTrue(codes.contains("KANBAN"));
    }

    @Test
    void getTemplateByCode() {
        PageTemplate template = templateService.getTemplate("CRUD");

        assertNotNull(template);
        assertEquals("CRUD", template.getCode());
        assertEquals("标准 CRUD 页面", template.getName());
        assertFalse(template.getDescription().isEmpty());
        assertNotNull(template.getJsonConfig());
    }

    @Test
    void getTemplateWithInvalidCodeThrows() {
        assertThrows(ResourceNotFoundException.class,
                () -> templateService.getTemplate("INVALID"));
    }

    @Test
    void createFromCrudTemplate() {
        PageConfig config = templateService.createFromTemplate("CRUD", "customer", null);

        assertNotNull(config);
        assertEquals(PageType.TABLE, config.getPageType());
        assertTrue(config.getName().contains("管理"));
        assertFalse(config.getSections().isEmpty());
    }

    @Test
    void createFromMasterDetailTemplate() {
        PageConfig config = templateService.createFromTemplate("MASTER_DETAIL", "order", null);

        assertNotNull(config);
        assertEquals(PageType.FORM, config.getPageType());
        assertTrue(config.getSections().size() >= 2);
    }

    @Test
    void createFromKanbanTemplate() {
        PageConfig config = templateService.createFromTemplate("KANBAN", "order", null);

        assertNotNull(config);
        assertEquals(PageType.KANBAN, config.getPageType());
    }

    @Test
    void templateHasJsonConfig() {
        for (PageTemplate template : templateService.listTemplates()) {
            assertNotNull(template.getJsonConfig());
            assertFalse(template.getJsonConfig().isEmpty());
        }
    }

    @Test
    void templateHasPageTypes() {
        PageTemplate crud = templateService.getTemplate("CRUD");
        assertFalse(crud.getPageTypes().isEmpty());
        assertTrue(crud.getPageTypes().contains(PageType.TABLE));
    }
}
