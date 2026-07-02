package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.KnowledgeBase;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, Long> {

    Optional<KnowledgeBase> findByCode(String code);

    Page<KnowledgeBase> findByType(KnowledgeBaseType type, Pageable pageable);
}
