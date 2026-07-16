package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.DocumentMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DocumentMetadataRepository extends JpaRepository<DocumentMetadata, Long> {

    Optional<DocumentMetadata> findByDocumentId(Long documentId);
}
