package com.metaplatform.capability.domain;

import java.util.List;
import java.util.Optional;

/**
 * 流水线仓库接口。
 */
public interface PipelineRepository {
    void save(Pipeline pipeline);
    Optional<Pipeline> findById(PipelineId id);
    Optional<Pipeline> findByName(String name);
    List<Pipeline> findAll();
    void deleteById(PipelineId id);
}
