package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.PromptVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromptVersionEntityRepository extends JpaRepository<PromptVersionEntity, Long> {

    List<PromptVersionEntity> findByPromptId(Long promptId);

    List<PromptVersionEntity> findByPromptIdOrderByVersionDesc(Long promptId);

    Optional<PromptVersionEntity> findByPromptIdAndVersion(Long promptId, Integer version);
}
