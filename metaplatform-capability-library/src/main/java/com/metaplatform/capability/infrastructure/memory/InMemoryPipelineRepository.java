package com.metaplatform.capability.infrastructure.memory;

import com.metaplatform.capability.domain.Pipeline;
import com.metaplatform.capability.domain.PipelineId;
import com.metaplatform.capability.domain.PipelineRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * v0.1 简化：内存流水线仓库。
 */
@Repository
public class InMemoryPipelineRepository implements PipelineRepository {
    private final ConcurrentMap<PipelineId, Pipeline> store = new ConcurrentHashMap<>();

    @Override
    public void save(Pipeline pipeline) {
        store.put(pipeline.id(), pipeline);
    }

    @Override
    public Optional<Pipeline> findById(PipelineId id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Pipeline> findByName(String name) {
        return store.values().stream()
                .filter(p -> p.name().equals(name))
                .findFirst();
    }

    @Override
    public List<Pipeline> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void deleteById(PipelineId id) {
        store.remove(id);
    }
}
