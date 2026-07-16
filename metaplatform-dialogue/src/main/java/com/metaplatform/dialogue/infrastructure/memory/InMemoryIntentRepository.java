package com.metaplatform.dialogue.infrastructure.memory;

import com.metaplatform.dialogue.domain.intent.Intent;
import com.metaplatform.dialogue.domain.intent.IntentCategory;
import com.metaplatform.dialogue.domain.intent.IntentId;
import com.metaplatform.dialogue.domain.intent.IntentRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * v0.1 简化：内存意图仓库。
 */
@Repository
public class InMemoryIntentRepository implements IntentRepository {
    private final ConcurrentMap<IntentId, Intent> store = new ConcurrentHashMap<>();

    @Override
    public void save(Intent intent) {
        store.put(intent.id(), intent);
    }

    @Override
    public Optional<Intent> findById(IntentId id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Intent> findByCategory(IntentCategory category) {
        return store.values().stream()
                .filter(i -> i.category() == category)
                .toList();
    }

    @Override
    public List<Intent> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void deleteById(IntentId id) {
        store.remove(id);
    }
}
