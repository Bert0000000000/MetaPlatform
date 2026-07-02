package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.embedding.EmbeddingRequest;
import com.metaplatform.ai.embedding.EmbeddingResponse;
import com.metaplatform.ai.embedding.EmbeddingService;
import com.metaplatform.ai.interfaces.rest.dto.EmbeddingApiRequest;
import com.metaplatform.ai.interfaces.rest.dto.EmbeddingApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/embeddings")
public class EmbeddingController {

    private final EmbeddingService embeddingService;

    public EmbeddingController(EmbeddingService embeddingService) {
        this.embeddingService = embeddingService;
    }

    @PostMapping
    public ResponseEntity<EmbeddingApiResponse> embed(
            @Valid @RequestBody EmbeddingApiRequest request,
            @RequestParam(defaultValue = "false") boolean useCache) {

        EmbeddingRequest embRequest = new EmbeddingRequest(request.model(), request.texts());
        EmbeddingResponse response = useCache ?
                embeddingService.embedWithCache(embRequest) :
                embeddingService.embed(embRequest);

        List<List<Float>> vectors = response.embeddings().stream()
                .map(EmbeddingResponse.Embedding::vector)
                .toList();

        return ResponseEntity.ok(new EmbeddingApiResponse(response.model(), vectors));
    }
}
