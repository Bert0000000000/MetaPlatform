package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.RecordLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecordLinkRepository extends JpaRepository<RecordLink, Long> {

    List<RecordLink> findByGoldenRecordId(Long goldenRecordId);

    List<RecordLink> findBySourceSystemAndSourceId(String sourceSystem, String sourceId);
}
