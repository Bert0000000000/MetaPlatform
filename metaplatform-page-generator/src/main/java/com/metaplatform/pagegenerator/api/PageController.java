package com.metaplatform.pagegenerator.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.pagegenerator.api.dto.NlPageGenerateRequest;
import com.metaplatform.pagegenerator.api.dto.PageGenerateRequest;
import com.metaplatform.pagegenerator.application.NlPageGenerator;
import com.metaplatform.pagegenerator.application.PageGeneratorService;
import com.metaplatform.pagegenerator.application.PageRenderService;
import com.metaplatform.pagegenerator.domain.PageConfig;
import com.metaplatform.pagegenerator.domain.PageConfigRepository;
import com.metaplatform.pagegenerator.infrastructure.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/**
 * 页面生成和渲染控制器
 */
@RestController
@RequestMapping("/api/v1/pages")
public class PageController {

    private final PageGeneratorService generatorService;
    private final NlPageGenerator nlGenerator;
    private final PageRenderService renderService;
    private final PageConfigRepository configRepository;

    public PageController(PageGeneratorService generatorService,
                           NlPageGenerator nlGenerator,
                           PageRenderService renderService,
                           PageConfigRepository configRepository) {
        this.generatorService = generatorService;
        this.nlGenerator = nlGenerator;
        this.renderService = renderService;
        this.configRepository = configRepository;
    }

    /**
     * 从 Schema 自动生成页面配置
     */
    @PostMapping("/generate")
    public PageConfig generateFromSchema(@Valid @RequestBody PageGenerateRequest request) {
        return generatorService.generate(
                request.getObjectCode(),
                request.getPageType(),
                request.getOptions()
        );
    }

    /**
     * 从自然语言生成页面配置
     */
    @PostMapping("/generate-from-nl")
    public PageConfig generateFromNaturalLanguage(
            @Valid @RequestBody NlPageGenerateRequest request) {
        return nlGenerator.generate(request.getDescription(), request.getObjectCode());
    }

    /**
     * 渲染已保存的页面配置为前端 JSON
     */
    @GetMapping("/{id}/render")
    public JsonNode renderPage(@PathVariable Long id) {
        PageConfig config = configRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PageConfig", id));
        return renderService.render(config, null);
    }

    /**
     * 一步到位: 生成 + 渲染
     */
    @PostMapping("/quick-create")
    public JsonNode quickCreate(@Valid @RequestBody PageGenerateRequest request) {
        PageConfig config = generatorService.generate(
                request.getObjectCode(),
                request.getPageType(),
                request.getOptions()
        );
        PageConfig saved = generatorService.save(config);
        return renderService.render(saved, null);
    }
}
