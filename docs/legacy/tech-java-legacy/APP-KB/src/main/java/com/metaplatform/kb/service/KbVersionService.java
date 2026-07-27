package com.metaplatform.kb.service;

import com.metaplatform.kb.config.KbProperties;
import com.metaplatform.kb.entity.KbVersionDiffEntity;
import com.metaplatform.kb.repository.KbVersionDiffRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.*;

@Service
public class KbVersionService {
    private final KbVersionDiffRepository repository;
    private final WebClient ragClient;
    public KbVersionService(KbVersionDiffRepository repository, WebClient.Builder builder, KbProperties properties) { this.repository = repository; this.ragClient = builder.clone().baseUrl(properties.getRagBaseUrl()).build(); }
    public Mono<Object> compareVersions(String kbId, String from, String to) { return ragClient.get().uri(uri -> uri.path("/api/v1/rag/knowledge-bases/{id}/versions/compare").queryParam("from", from).queryParam("to", to).build(kbId)).retrieve().bodyToMono(Object.class); }
    public Mono<Object> rollbackVersion(String kbId, String target, String userId) {
        return ragClient.post().uri("/api/v1/rag/knowledge-bases/{id}/versions/{version}/rollback", kbId, target).bodyValue(Map.of("userId", userId)).retrieve().bodyToMono(Object.class)
                .doOnSuccess(result -> { KbVersionDiffEntity diff = new KbVersionDiffEntity(); diff.setKbId(kbId); diff.setToVersion(target); diff.setDiffType("KB_CONFIG"); diff.setChanges(String.valueOf(result)); repository.save(diff); });
    }
    public List<KbVersionDiffEntity> getVersionHistory(String kbId) { return repository.findByKbIdOrderByCreatedAtDesc(kbId); }
    @Transactional public int cleanupOldVersions(String kbId, int keepCount) { List<KbVersionDiffEntity> all = getVersionHistory(kbId); if (all.size() <= keepCount) return 0; List<KbVersionDiffEntity> old = all.subList(keepCount, all.size()); repository.deleteAll(old); return old.size(); }
}
