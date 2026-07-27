package com.metaplatform.rag.citations.controller;

import com.metaplatform.rag.citations.dto.CitationDto;
import com.metaplatform.rag.citations.dto.CitationLocateRequest;
import com.metaplatform.rag.citations.service.CitationService;
import com.metaplatform.rag.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rag/citations")
@RequiredArgsConstructor
public class CitationController {

    private final CitationService citationService;

    @PostMapping("/locate")
    public ApiResponse<List<CitationDto>> locateCitations(@RequestBody CitationLocateRequest request) {
        return ApiResponse.ok(citationService.locateCitations(request));
    }

    @GetMapping("/{chunkId}")
    public ApiResponse<CitationDto> getCitation(@PathVariable UUID chunkId) {
        return ApiResponse.ok(citationService.getCitation(chunkId));
    }

    @PostMapping("/batch")
    public ApiResponse<List<CitationDto>> batchCitations(@RequestBody List<UUID> chunkIds) {
        return ApiResponse.ok(citationService.batchCitations(chunkIds));
    }
}
