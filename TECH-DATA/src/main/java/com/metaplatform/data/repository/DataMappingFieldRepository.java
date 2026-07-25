package com.metaplatform.data.repository;

import com.metaplatform.data.entity.DataMappingFieldEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DataMappingFieldRepository extends JpaRepository<DataMappingFieldEntity, String> {

    List<DataMappingFieldEntity> findByTenantIdAndMappingIdOrderByCreatedAtAsc(String tenantId, String mappingId);

    Optional<DataMappingFieldEntity> findByIdAndTenantId(String id, String tenantId);

    long countByTenantIdAndMappingId(String tenantId, String mappingId);

    @Modifying
    @Query("DELETE FROM DataMappingFieldEntity f WHERE f.tenantId = :tenantId AND f.mappingId = :mappingId")
    int deleteByTenantIdAndMappingId(@Param("tenantId") String tenantId, @Param("mappingId") String mappingId);
}
