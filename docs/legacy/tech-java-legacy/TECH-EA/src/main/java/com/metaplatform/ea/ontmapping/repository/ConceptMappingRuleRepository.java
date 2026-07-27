package com.metaplatform.ea.ontmapping.repository;

import com.metaplatform.ea.ontmapping.entity.ConceptMappingRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConceptMappingRuleRepository extends JpaRepository<ConceptMappingRuleEntity, UUID> {

    Optional<ConceptMappingRuleEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

    List<ConceptMappingRuleEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<ConceptMappingRuleEntity> findByTenantIdAndAssetTypeAndDeletedAtIsNull(String tenantId, String assetType);

    List<ConceptMappingRuleEntity> findByTenantIdAndConceptIdAndDeletedAtIsNull(String tenantId, String conceptId);

    List<ConceptMappingRuleEntity> findByTenantIdAndAssetTypeAndAssetIdAndDeletedAtIsNull(String tenantId, String assetType, UUID assetId);

    boolean existsByTenantIdAndAssetTypeAndAssetIdAndConceptIdAndDeletedAtIsNull(
            String tenantId, String assetType, UUID assetId, String conceptId);

    long countByTenantIdAndDeletedAtIsNull(String tenantId);
}
