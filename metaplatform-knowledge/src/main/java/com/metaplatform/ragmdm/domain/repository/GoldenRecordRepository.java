package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.GoldenRecord;
import com.metaplatform.ragmdm.domain.enums.GoldenRecordStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GoldenRecordRepository extends JpaRepository<GoldenRecord, Long> {

    Page<GoldenRecord> findByEntityType(String entityType, Pageable pageable);

    List<GoldenRecord> findByEntityTypeAndStatus(String entityType, GoldenRecordStatus status);
}
