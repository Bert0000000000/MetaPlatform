package com.metaplatform.agent.skills;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SkillService {

    private final SkillRepository repository;

    public SkillEntity register(SkillEntity s) {
        s.setId("SK-" + UUID.randomUUID());
        s.setVersion(1);
        s.setEnabled(true);
        s.setCreatedAt(Instant.now());
        s.setUpdatedAt(Instant.now());
        if (s.getSkillType() == null) s.setSkillType("PROMPT");
        return repository.save(s);
    }

    public SkillEntity update(String id, SkillEntity patch) {
        SkillEntity s = repository.findById(id).orElseThrow();
        if (patch.getDisplayName() != null) s.setDisplayName(patch.getDisplayName());
        if (patch.getDescription() != null) s.setDescription(patch.getDescription());
        if (patch.getContent() != null) s.setContent(patch.getContent());
        if (patch.getTools() != null) s.setTools(patch.getTools());
        s.setEnabled(patch.isEnabled());
        s.setVersion(s.getVersion() + 1);
        s.setUpdatedAt(Instant.now());
        return repository.save(s);
    }

    public SkillEntity get(String tenantId, String skillCode) {
        return repository.findByTenantIdAndSkillCodeAndEnabledTrue(tenantId, skillCode)
                .orElseThrow(() -> new IllegalArgumentException("skill not found: " + skillCode));
    }
}
