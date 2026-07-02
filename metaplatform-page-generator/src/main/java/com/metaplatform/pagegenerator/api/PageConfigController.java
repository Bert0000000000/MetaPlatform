package com.metaplatform.pagegenerator.api;

import com.metaplatform.pagegenerator.api.dto.PageConfigCreateRequest;
import com.metaplatform.pagegenerator.api.dto.PageConfigUpdateRequest;
import com.metaplatform.pagegenerator.application.PageGeneratorService;
import com.metaplatform.pagegenerator.domain.PageConfig;
import com.metaplatform.pagegenerator.domain.PageConfigRepository;
import com.metaplatform.pagegenerator.domain.enums.ConfigStatus;
import com.metaplatform.pagegenerator.domain.enums.PageType;
import com.metaplatform.pagegenerator.infrastructure.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * PageConfig CRUD 控制器
 */
@RestController
@RequestMapping("/api/v1/page-configs")
public class PageConfigController {

    private final PageConfigRepository repository;
    private final PageGeneratorService generatorService;

    public PageConfigController(PageConfigRepository repository,
                                 PageGeneratorService generatorService) {
        this.repository = repository;
        this.generatorService = generatorService;
    }

    @GetMapping
    public List<PageConfig> list(
            @RequestParam(required = false) PageType pageType,
            @RequestParam(required = false) String objectCode) {
        if (pageType != null && objectCode != null) {
            return repository.findByPageTypeAndObjectCode(pageType, objectCode);
        } else if (pageType != null) {
            return repository.findByPageType(pageType);
        } else if (objectCode != null) {
            return repository.findByObjectCode(objectCode);
        }
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public PageConfig getById(@PathVariable Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PageConfig", id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PageConfig create(@Valid @RequestBody PageConfigCreateRequest request) {
        PageConfig config = new PageConfig();
        config.setName(request.getName());
        config.setCode(request.getCode());
        config.setPageType(request.getPageType());
        config.setObjectCode(request.getObjectCode());
        config.setStatus(ConfigStatus.DRAFT);
        config.setCreatedBy("api");
        return generatorService.save(config);
    }

    @PutMapping("/{id}")
    public PageConfig update(@PathVariable Long id,
                              @Valid @RequestBody PageConfigUpdateRequest request) {
        PageConfig existing = getById(id);
        if (request.getName() != null) existing.setName(request.getName());
        if (request.getPageType() != null) existing.setPageType(request.getPageType());
        if (request.getSections() != null) existing.setSections(request.getSections());
        if (request.getViewConfig() != null) existing.setViewConfig(request.getViewConfig());
        existing.setUpdatedAt(LocalDateTime.now());
        return generatorService.save(existing);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("PageConfig", id);
        }
        repository.deleteById(id);
    }

    @PostMapping("/{id}/publish")
    public PageConfig publish(@PathVariable Long id) {
        PageConfig config = getById(id);
        config.setStatus(ConfigStatus.PUBLISHED);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }

    @PostMapping("/{id}/archive")
    public PageConfig archive(@PathVariable Long id) {
        PageConfig config = getById(id);
        config.setStatus(ConfigStatus.ARCHIVED);
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }
}
