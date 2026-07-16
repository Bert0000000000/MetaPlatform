package com.metaplatform.pagegenerator.api;

import com.metaplatform.pagegenerator.api.dto.TemplateApplyRequest;
import com.metaplatform.pagegenerator.application.TemplateService;
import com.metaplatform.pagegenerator.domain.PageConfig;
import com.metaplatform.pagegenerator.domain.PageTemplate;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 页面模板控制器
 */
@RestController
@RequestMapping("/api/v1/page-templates")
public class PageTemplateController {

    private final TemplateService templateService;

    public PageTemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<PageTemplate> listTemplates() {
        return templateService.listTemplates();
    }

    @GetMapping("/{code}")
    public PageTemplate getTemplate(@PathVariable String code) {
        return templateService.getTemplate(code);
    }

    /**
     * 应用模板生成页面配置
     */
    @PostMapping("/{code}/apply")
    public PageConfig applyTemplate(@PathVariable String code,
                                     @Valid @RequestBody TemplateApplyRequest request) {
        return templateService.createFromTemplate(
                code, request.getObjectCode(), request.getOverrides()
        );
    }
}
