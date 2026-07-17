package com.metaplatform.ea.mapping.repository;

import com.metaplatform.ea.mapping.entity.CapabilityConceptMappingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CapabilityConceptMappingRepository extends JpaRepository<CapabilityConceptMappingEntity, UUID> {

    Optional<CapabilityConceptMappingEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    List<CapabilityConceptMappingEntity> findByTenantIdAndCapabilityIdAndDeletedAtIsNull(String tenantId, UUID capabilityId);

    List<CapabilityConceptMappingEntity> findByTenantIdAndConceptIdAndDeletedAtIsNull(String tenantId, String conceptId);

    List<CapabilityConceptMappingEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<CapabilityConceptMappingEntity> findByTenantIdAndMappingTypeAndDeletedAtIsNull(String tenantId, String mappingType);

    long countByTenantIdAndDeletedAtIsNull(String tenantId);

    long countByTenantIdAndMappingTypeAndDeletedAtIsNull(String tenantId, String mappingType);

    boolean existsByTenantIdAndCapabilityIdAndConceptIdAndDeletedAtIsNull(String tenantId, UUID capabilityId, String conceptId);
}
