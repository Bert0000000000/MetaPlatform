package com.metaplatform.ragmdm.api;

import com.metaplatform.ragmdm.api.dto.KnowledgeBaseCreateRequest;
import com.metaplatform.ragmdm.api.dto.KnowledgeBaseUpdateRequest;
import com.metaplatform.ragmdm.domain.KnowledgeBase;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import com.metaplatform.ragmdm.unstructured.KnowledgeBaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/knowledge")
@RequiredArgsConstructor
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;

    @GetMapping
    public Page<KnowledgeBase> list(
            @RequestParam(required = false) KnowledgeBaseType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return knowledgeBaseService.list(type, PageRequest.of(page, size));
    }

    @GetMapping("/{id}")
    public KnowledgeBase getById(@PathVariable Long id) {
        return knowledgeBaseService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KnowledgeBase create(@Valid @RequestBody KnowledgeBaseCreateRequest request) {
        return knowledgeBaseService.create(request);
    }

    @PutMapping("/{id}")
    public KnowledgeBase update(@PathVariable Long id,
                                 @Valid @RequestBody KnowledgeBaseUpdateRequest request) {
        return knowledgeBaseService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        knowledgeBaseService.delete(id);
    }
}
