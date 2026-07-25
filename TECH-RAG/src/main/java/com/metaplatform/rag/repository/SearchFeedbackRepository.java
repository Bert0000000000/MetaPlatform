package com.metaplatform.rag.repository;

import com.metaplatform.rag.entity.SearchFeedbackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SearchFeedbackRepository extends JpaRepository<SearchFeedbackEntity, UUID> {

    List<SearchFeedbackEntity> findAllByKbId(UUID kbId);

    List<SearchFeedbackEntity> findAllByChunkId(UUID chunkId);

    List<SearchFeedbackEntity> findAllByQueryContainingIgnoreCase(String query);
}
