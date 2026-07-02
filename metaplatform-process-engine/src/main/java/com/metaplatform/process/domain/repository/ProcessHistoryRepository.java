package com.metaplatform.process.domain.repository;

import com.metaplatform.process.domain.ProcessHistoryEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessHistoryRepository extends JpaRepository<ProcessHistoryEvent, Long> {

    List<ProcessHistoryEvent> findByInstanceIdOrderByTimestampAsc(Long instanceId);

    List<ProcessHistoryEvent> findByInstanceIdAndNodeIdOrderByTimestampAsc(Long instanceId, String nodeId);

    Page<ProcessHistoryEvent> findByActorIdOrderByTimestampDesc(String actorId, Pageable pageable);
}
