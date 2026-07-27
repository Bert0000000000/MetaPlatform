package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DataOutboxEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Kafka Outbox 事件仓储。
 */
@Repository
public interface DataOutboxRepository extends JpaRepository<DataOutboxEntity, Long> {

    /**
     * 按租户 + ID 查询。
     */
    Optional<DataOutboxEntity> findByIdAndTenantId(Long id, String tenantId);

    /**
     * 按租户分页查询。
     */
    Page<DataOutboxEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按状态分页查询（Outbox 轮询消费使用）。
     */
    Page<DataOutboxEntity> findByStatus(String status, Pageable pageable);

    /**
     * 按状态 + 创建时间早于指定时刻查询（超时重投递使用）。
     */
    List<DataOutboxEntity> findByStatusAndCreatedAtBefore(String status, OffsetDateTime before);

    /**
     * 按租户 + 状态分页查询。
     */
    Page<DataOutboxEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 聚合类型分页查询。
     */
    Page<DataOutboxEntity> findByTenantIdAndAggregateType(String tenantId, String aggregateType, Pageable pageable);
}
