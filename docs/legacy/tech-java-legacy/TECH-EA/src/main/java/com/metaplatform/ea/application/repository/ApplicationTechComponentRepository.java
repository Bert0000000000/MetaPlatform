package com.metaplatform.ea.application.repository;

import com.metaplatform.ea.application.entity.ApplicationTechComponentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationTechComponentRepository extends JpaRepository<ApplicationTechComponentEntity, UUID> {

    Optional<ApplicationTechComponentEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ApplicationTechComponentEntity> findByTenantIdAndApplicationIdAndDeletedAtIsNull(
            String tenantId, UUID applicationId);

    List<ApplicationTechComponentEntity> findByTenantIdAndTechComponentIdAndDeletedAtIsNull(
            String tenantId, UUID techComponentId);

    Optional<ApplicationTechComponentEntity> findByTenantIdAndApplicationIdAndTechComponentIdAndRelationshipTypeAndDeletedAtIsNull(
            String tenantId, UUID applicationId, UUID techComponentId, String relationshipType);

    boolean existsByTenantIdAndApplicationIdAndTechComponentIdAndRelationshipTypeAndDeletedAtIsNull(
            String tenantId, UUID applicationId, UUID techComponentId, String relationshipType);
}
