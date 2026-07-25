package com.metaplatform.rag.documents.controller;

import com.metaplatform.rag.common.ApiResponse;
import com.metaplatform.rag.documents.dto.DocumentDto;
import com.metaplatform.rag.documents.dto.UploadResult;
import com.metaplatform.rag.documents.service.DocumentService;
import com.metaplatform.rag.entity.ChunkEntity;
import com.metaplatform.rag.repository.ChunkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final ChunkRepository chunkRepository;

    @PostMapping("/api/v1/rag/knowledge-bases/{kbId}/documents")
    public ApiResponse<UploadResult> uploadDocument(
        @PathVariable UUID kbId,
        @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.ok(documentService.uploadDocument(kbId, file, "system"));
    }

    @GetMapping("/api/v1/rag/knowledge-bases/{kbId}/documents")
    public ApiResponse<List<DocumentDto>> listDocuments(@PathVariable UUID kbId) {
        return ApiResponse.ok(documentService.listDocuments(kbId));
    }

    @GetMapping("/api/v1/rag/documents/{docId}")
    public ApiResponse<DocumentDto> getDocument(@PathVariable UUID docId) {
        return ApiResponse.ok(documentService.getDocument(docId));
    }

    @DeleteMapping("/api/v1/rag/documents/{docId}")
    public ApiResponse<Void> deleteDocument(@PathVariable UUID docId) {
        documentService.deleteDocument(docId);
        return ApiResponse.ok();
    }

    @PostMapping("/api/v1/rag/documents/{docId}/reparse")
    public ApiResponse<DocumentDto> reparseDocument(@PathVariable UUID docId) {
        return ApiResponse.ok(documentService.reparseDocument(docId));
    }

    @GetMapping("/api/v1/rag/documents/{docId}/chunks")
    public ApiResponse<List<ChunkEntity>> getDocumentChunks(@PathVariable UUID docId) {
        return ApiResponse.ok(chunkRepository.findAllByDocIdOrderBySequenceAsc(docId));
    }
}
