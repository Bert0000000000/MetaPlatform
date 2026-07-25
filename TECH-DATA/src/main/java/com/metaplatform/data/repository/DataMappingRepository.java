package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DataMappingEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DataMappingRepository extends JpaRepository<DataMappingEntity, String> {

    Optional<DataMappingEntity> findByIdAndTenantId(String id, String tenantId);

    boolean existsByTenantIdAndName(String tenantId, String name);

    Page<DataMappingEntity> findByTenantId(String tenantId, Pageable pageable);

    Page<DataMappingEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 多条件过滤查询（datasourceId / ontologyEntityId / status 均可选）。
     */
    @Query("SELECT m FROM DataMappingEntity m " +
           "WHERE m.tenantId = :tenantId " +
           "AND (:datasourceId IS NULL OR m.datasourceId = :datasourceId) " +
           "AND (:ontologyEntityId IS NULL OR m.ontologyEntityId = :ontologyEntityId) " +
           "AND (:status IS NULL OR m.status = :status) " +
           "ORDER BY m.createdAt DESC")
    Page<DataMappingEntity> search(@Param("tenantId") String tenantId,
                                   @Param("datasourceId") String datasourceId,
                                   @Param("ontologyEntityId") String ontologyEntityId,
                                   @Param("status") String status,
                                   Pageable pageable);
}
