package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.CodeTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeTemplateEntityRepository extends JpaRepository<CodeTemplateEntity, Long> {

    List<CodeTemplateEntity> findByLanguage(String language);

    List<CodeTemplateEntity> findByIsActive(Boolean isActive);

    List<CodeTemplateEntity> findByName(String name);
}
