package com.metaplatform.ragmdm.api;

import com.metaplatform.ragmdm.domain.Document;
import com.metaplatform.ragmdm.unstructured.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Document upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("knowledgeBaseId") Long knowledgeBaseId,
            @RequestParam(value = "title", required = false) String title) {
        return documentService.upload(file, knowledgeBaseId, title, "system");
    }

    @GetMapping("/{id}")
    public Document getById(@PathVariable Long id) {
        return documentService.getById(id);
    }

    @GetMapping
    public Page<Document> list(
            @RequestParam Long knowledgeBaseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return documentService.listByKnowledgeBase(knowledgeBaseId,
            PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        documentService.delete(id);
    }
}
