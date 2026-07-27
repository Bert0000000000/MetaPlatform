package com.metaplatform.msg.repository;

import com.metaplatform.msg.entity.OutboxMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface OutboxMessageRepository extends JpaRepository<OutboxMessageEntity, String> {

    @Query("SELECT m FROM OutboxMessageEntity m WHERE m.status = :status " +
           "AND (m.nextRetryAt IS NULL OR m.nextRetryAt <= :now) " +
           "ORDER BY m.createdAt ASC")
    List<OutboxMessageEntity> findPendingForRelay(@Param("status") OutboxMessageEntity.OutboxStatus status,
                                                   @Param("now") Instant now,
                                                   Pageable pageable);

    Page<OutboxMessageEntity> findByStatus(OutboxMessageEntity.OutboxStatus status, Pageable pageable);

    @Query("SELECT m.status, COUNT(m) FROM OutboxMessageEntity m GROUP BY m.status")
    List<Object[]> countByStatus();

    @Modifying
    @Query("UPDATE OutboxMessageEntity m SET m.status = :status WHERE m.id = :id")
    int updateStatus(@Param("id") String id, @Param("status") OutboxMessageEntity.OutboxStatus status);
}
