package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    Page<Document> findByKnowledgeBaseId(Long knowledgeBaseId, Pageable pageable);
}
