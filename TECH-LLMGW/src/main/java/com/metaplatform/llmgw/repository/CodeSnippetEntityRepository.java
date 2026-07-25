package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.CodeSnippetEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeSnippetEntityRepository extends JpaRepository<CodeSnippetEntity, Long> {

    List<CodeSnippetEntity> findByTemplateId(Long templateId);

    List<CodeSnippetEntity> findByLanguage(String language);

    List<CodeSnippetEntity> findByTitle(String title);
}
