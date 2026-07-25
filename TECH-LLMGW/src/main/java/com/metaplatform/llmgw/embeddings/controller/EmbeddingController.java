package com.metaplatform.llmgw.embeddings.controller;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.embeddings.dto.EmbeddingRequest;
import com.metaplatform.llmgw.embeddings.dto.EmbeddingResponse;
import com.metaplatform.llmgw.embeddings.service.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/llmgw/embeddings")
@RequiredArgsConstructor
public class EmbeddingController {

    private final EmbeddingService embeddingService;

    @PostMapping
    public ApiResponse<EmbeddingResponse> embed(@RequestBody EmbeddingRequest request) {
        return ApiResponse.success(embeddingService.embed(request));
    }
}
