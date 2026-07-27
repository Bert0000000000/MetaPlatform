package com.metaplatform.kb.controller;

import com.metaplatform.kb.config.KbProperties;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/knowledge-base")
public class SearchController {
    private final WebClient client;
    public SearchController(WebClient.Builder b,KbProperties p){client=b.clone().baseUrl(p.getRagBaseUrl()).build();}
    @PostMapping("/{kbId}/search") public Mono<Object> search(@PathVariable String kbId,@RequestBody Object body){return post(kbId,"search",body);}
    @PostMapping("/{kbId}/search/hybrid") public Mono<Object> hybrid(@PathVariable String kbId,@RequestBody Object body){return post(kbId,"hybrid",body);}
    @PostMapping(value="/{kbId}/search/stream",produces="text/event-stream") public Flux<ServerSentEvent<String>> stream(@PathVariable String kbId,@RequestBody Object body){return client.post().uri("/api/v1/rag/knowledge-bases/{id}/stream",kbId).bodyValue(body).retrieve().bodyToFlux(String.class).map(data->ServerSentEvent.builder(data).build());}
    @PostMapping("/{kbId}/search/feedback") public Mono<Object> feedback(@PathVariable String kbId,@RequestBody Object body){return client.post().uri("/api/v1/rag/feedback").bodyValue(body).retrieve().bodyToMono(Object.class);}
    private Mono<Object> post(String id,String suffix,Object body){return client.post().uri("/api/v1/rag/knowledge-bases/{id}/{suffix}",id,suffix).bodyValue(body).retrieve().bodyToMono(Object.class);}
}
