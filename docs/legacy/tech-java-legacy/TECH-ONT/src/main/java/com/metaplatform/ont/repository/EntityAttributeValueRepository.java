package com.metaplatform.ont.repository;

import com.metaplatform.ont.entity.EntityAttributeValueEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntityAttributeValueRepository extends JpaRepository<EntityAttributeValueEntity, Long> {

    List<EntityAttributeValueEntity> findByTenantIdAndEntityId(String tenantId, String entityId);

    List<EntityAttributeValueEntity> findByTenantIdAndAttributeId(String tenantId, String attributeId);

    Optional<EntityAttributeValueEntity> findByTenantIdAndEntityIdAndAttributeId(String tenantId, String entityId, String attributeId);

    void deleteByTenantIdAndEntityId(String tenantId, String entityId);

    long countByTenantIdAndAttributeId(String tenantId, String attributeId);
}
