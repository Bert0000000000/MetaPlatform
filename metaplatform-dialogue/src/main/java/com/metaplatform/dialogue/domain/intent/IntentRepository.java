package com.metaplatform.dialogue.domain.intent;

import java.util.List;
import java.util.Optional;

/**
 * 意图仓库接口。
 */
public interface IntentRepository {
    void save(Intent intent);
    Optional<Intent> findById(IntentId id);
    List<Intent> findByCategory(IntentCategory category);
    List<Intent> findAll();
    void deleteById(IntentId id);
}
