package com.metaplatform.kb.controller;

import com.metaplatform.kb.config.KbProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/knowledge-base/citations")
public class CitationsController {
    private final WebClient client;
    public CitationsController(WebClient.Builder b,KbProperties p){client=b.clone().baseUrl(p.getRagBaseUrl()).build();}
    @PostMapping("/locate") public Mono<Object> locate(@RequestBody Object body){return post("/api/v1/rag/citations/locate",body);}
    @GetMapping("/{chunkId}") public Mono<Object> get(@PathVariable String chunkId){return client.get().uri("/api/v1/rag/citations/{id}",chunkId).retrieve().bodyToMono(Object.class);}
    @PostMapping("/batch") public Mono<Object> batch(@RequestBody Object body){return post("/api/v1/rag/citations/batch",body);}
    private Mono<Object> post(String uri,Object body){return client.post().uri(uri).bodyValue(body).retrieve().bodyToMono(Object.class);}
}
