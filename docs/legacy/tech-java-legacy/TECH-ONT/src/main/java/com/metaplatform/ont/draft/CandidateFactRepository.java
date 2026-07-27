package com.metaplatform.ont.draft;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CandidateFactRepository extends JpaRepository<CandidateFactEntity, String> {

    List<CandidateFactEntity> findByDraftId(String draftId);

    long countByDraftIdAndConflictLevel(String draftId, String conflictLevel);
}
