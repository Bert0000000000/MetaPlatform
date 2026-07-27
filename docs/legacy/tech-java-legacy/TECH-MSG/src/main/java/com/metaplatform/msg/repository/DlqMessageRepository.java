package com.metaplatform.msg.repository;

import com.metaplatform.msg.entity.DlqMessageEntity;
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
public interface DlqMessageRepository extends JpaRepository<DlqMessageEntity, String> {

    @Query("SELECT m FROM DlqMessageEntity m WHERE m.tenantId = :tenantId " +
           "AND (:topic IS NULL OR m.originalTopic = :topic) " +
           "AND (:status IS NULL OR m.status = :status) " +
           "ORDER BY m.createdAt DESC")
    Page<DlqMessageEntity> findByFilters(@Param("tenantId") String tenantId,
                                          @Param("topic") String topic,
                                          @Param("status") DlqMessageEntity.DlqStatus status,
                                          Pageable pageable);

    @Query("SELECT m FROM DlqMessageEntity m WHERE m.tenantId = :tenantId " +
           "AND m.originalTopic = :topic " +
           "AND m.status IN :statuses " +
           "AND m.updatedAt < :cutoff")
    List<DlqMessageEntity> findExpiredMessages(@Param("tenantId") String tenantId,
                                                @Param("topic") String topic,
                                                @Param("statuses") List<DlqMessageEntity.DlqStatus> statuses,
                                                @Param("cutoff") Instant cutoff);

    @Modifying
    @Query("DELETE FROM DlqMessageEntity m WHERE m.id IN :ids")
    int deleteByIds(@Param("ids") List<String> ids);

    List<DlqMessageEntity> findByTenantIdAndStatusIn(String tenantId, List<DlqMessageEntity.DlqStatus> statuses);
}
