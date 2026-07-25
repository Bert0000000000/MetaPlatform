package com.metaplatform.kb.controller;

import com.metaplatform.kb.config.KbProperties;
import org.springframework.http.MediaType;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/knowledge-base/{kbId}/documents")
public class DocumentsController {
    private final WebClient client;
    public DocumentsController(WebClient.Builder b,KbProperties p){client=b.clone().baseUrl(p.getRagBaseUrl()).build();}
    @GetMapping public Mono<Object> list(@PathVariable String kbId){return client.get().uri("/api/v1/rag/knowledge-bases/{id}/documents",kbId).retrieve().bodyToMono(Object.class);}
    @PostMapping public Mono<Object> upload(@PathVariable String kbId,@RequestBody Object body){return client.post().uri("/api/v1/rag/knowledge-bases/{id}/documents",kbId).bodyValue(body).retrieve().bodyToMono(Object.class);}
    @GetMapping("/{docId}") public Mono<Object> get(@PathVariable String docId){return client.get().uri("/api/v1/rag/documents/{id}",docId).retrieve().bodyToMono(Object.class);}
    @DeleteMapping("/{docId}") public Mono<Void> delete(@PathVariable String docId){return client.delete().uri("/api/v1/rag/documents/{id}",docId).retrieve().bodyToMono(Void.class);}
    @PostMapping("/{docId}/reparse") public Mono<Object> reparse(@PathVariable String docId){return client.post().uri("/api/v1/rag/documents/{id}/reparse",docId).retrieve().bodyToMono(Object.class);}
    @GetMapping("/{docId}/chunks") public Mono<Object> chunks(@PathVariable String docId){return client.get().uri("/api/v1/rag/documents/{id}/chunks",docId).retrieve().bodyToMono(Object.class);}
}
