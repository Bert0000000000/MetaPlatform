package com.metaplatform.kb.controller;

import com.metaplatform.kb.dto.RollbackRequest;
import com.metaplatform.kb.entity.KbVersionDiffEntity;
import com.metaplatform.kb.service.KbVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.*;

@RestController
@RequestMapping("/api/v1/knowledge-base/{kbId}/versions")
@RequiredArgsConstructor
public class VersionController {
    private final KbVersionService service;
    @GetMapping("/compare") public Mono<Object> compare(@PathVariable String kbId,@RequestParam("from") String from,@RequestParam("to") String to){return service.compareVersions(kbId,from,to);}
    @PostMapping("/{version}/rollback") public Mono<Object> rollback(@PathVariable String kbId,@PathVariable String version,@RequestBody RollbackRequest request){return service.rollbackVersion(kbId,version,request.userId());}
    @GetMapping("/history") public List<KbVersionDiffEntity> history(@PathVariable String kbId){return service.getVersionHistory(kbId);}
    @PostMapping("/cleanup") public Map<String,Integer> cleanup(@PathVariable String kbId,@RequestParam(defaultValue="10") int keep){return Map.of("deleted",service.cleanupOldVersions(kbId,keep));}
}
