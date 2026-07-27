package com.metaplatform.ont.diff;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Version Diff Service（P1.1.5）。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>{@link #record}：记录一次 diff（由 Commit Service 调用，P1.3 接通）</li>
 *   <li>{@link #diff}：拉取两版本之间的所有 diff 项</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VersionDiffService {

    private final VersionDiffRepository repository;
    private final ObjectMapper objectMapper;

    public VersionDiffEntity record(String tenantId, String fromVersion, String toVersion,
                                     VersionDiffEntity.DiffType type, Object changes) {
        String json;
        try {
            json = objectMapper.writeValueAsString(changes);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("diff changes 序列化失败", e);
        }
        VersionDiffEntity e = VersionDiffEntity.builder()
                .id("DIFF-" + UUID.randomUUID())
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .fromVersion(fromVersion)
                .toVersion(toVersion)
                .diffType(type.name())
                .changes(json)
                .createdAt(Instant.now())
                .build();
        return repository.save(e);
    }

    public List<VersionDiffEntity> diff(String tenantId, String fromVersion, String toVersion) {
        if (fromVersion == null) {
            return repository.findByTenantIdAndToVersionOrderByCreatedAtDesc(tenantId, toVersion);
        }
        return repository.findByTenantIdOrderByCreatedAtDesc(tenantId).stream()
                .filter(d -> d.getToVersion().equals(toVersion))
                .filter(d -> fromVersion == null || d.getFromVersion() == null || d.getFromVersion().equals(fromVersion))
                .toList();
    }
}
