package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.PromptEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PromptEntityRepository extends JpaRepository<PromptEntity, Long> {

    List<PromptEntity> findByCategory(String category);

    List<PromptEntity> findByIsActive(Boolean isActive);

    List<PromptEntity> findByName(String name);
}
