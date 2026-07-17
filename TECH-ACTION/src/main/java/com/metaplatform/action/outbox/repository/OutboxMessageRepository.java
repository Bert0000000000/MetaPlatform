package com.metaplatform.action.outbox.repository;

import com.metaplatform.action.outbox.entity.OutboxMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxMessageRepository extends JpaRepository<OutboxMessageEntity, UUID> {

    @Query("SELECT m FROM OutboxMessageEntity m " +
           "WHERE m.status = :status AND m.nextRetryAt <= :now " +
           "ORDER BY m.createdAt ASC")
    List<OutboxMessageEntity> findPendingForRelay(@Param("status") String status,
                                                   @Param("now") Instant now,
                                                   Pageable pageable);

    long countByStatus(String status);
}
