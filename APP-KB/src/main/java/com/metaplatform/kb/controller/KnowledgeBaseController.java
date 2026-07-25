package com.metaplatform.kb.controller;

import com.metaplatform.kb.config.KbProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/knowledge-base")
public class KnowledgeBaseController {
    private final WebClient client;
    public KnowledgeBaseController(WebClient.Builder builder, KbProperties p) { client=builder.clone().baseUrl(p.getRagBaseUrl()).build(); }
    @GetMapping public Mono<Object> list(){return client.get().uri("/api/v1/rag/knowledge-bases").retrieve().bodyToMono(Object.class);}
    @PostMapping public Mono<Object> create(@RequestBody Object b){return client.post().uri("/api/v1/rag/knowledge-bases").bodyValue(b).retrieve().bodyToMono(Object.class);}
    @GetMapping("/{kbId}") public Mono<Object> get(@PathVariable String kbId){return client.get().uri("/api/v1/rag/knowledge-bases/{id}",kbId).retrieve().bodyToMono(Object.class);}
    @PutMapping("/{kbId}") public Mono<Object> update(@PathVariable String kbId,@RequestBody Object b){return client.put().uri("/api/v1/rag/knowledge-bases/{id}",kbId).bodyValue(b).retrieve().bodyToMono(Object.class);}
    @DeleteMapping("/{kbId}") public Mono<Void> delete(@PathVariable String kbId){return client.delete().uri("/api/v1/rag/knowledge-bases/{id}",kbId).retrieve().bodyToMono(Void.class);}
    @GetMapping("/{kbId}/metrics") public Mono<Object> metrics(@PathVariable String kbId){return getSuffix(kbId,"metrics");}
    @GetMapping("/{kbId}/versions") public Mono<Object> versions(@PathVariable String kbId){return getSuffix(kbId,"versions");}
    @GetMapping("/{kbId}/permissions") public Mono<Object> permissions(@PathVariable String kbId){return getSuffix(kbId,"permissions");}
    @GetMapping("/{kbId}/retrieval-config") public Mono<Object> config(@PathVariable String kbId){return getSuffix(kbId,"retrieval-config");}
    @PutMapping("/{kbId}/retrieval-config") public Mono<Object> config(@PathVariable String kbId,@RequestBody Object b){return client.put().uri("/api/v1/rag/knowledge-bases/{id}/retrieval-config",kbId).bodyValue(b).retrieve().bodyToMono(Object.class);}
    private Mono<Object> getSuffix(String id,String suffix){return client.get().uri("/api/v1/rag/knowledge-bases/{id}/{suffix}",id,suffix).retrieve().bodyToMono(Object.class);}
}
