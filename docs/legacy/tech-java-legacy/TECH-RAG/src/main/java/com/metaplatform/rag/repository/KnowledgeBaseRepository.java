package com.metaplatform.rag.repository;

import com.metaplatform.rag.entity.KnowledgeBaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, UUID> {

    List<KnowledgeBaseEntity> findAllByIsActiveTrue();

    List<KnowledgeBaseEntity> findAllByCreatedBy(String createdBy);
}
