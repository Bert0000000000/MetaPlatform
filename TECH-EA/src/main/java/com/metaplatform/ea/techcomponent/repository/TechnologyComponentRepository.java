package com.metaplatform.ea.techcomponent.repository;

import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechnologyComponentRepository extends JpaRepository<TechnologyComponentEntity, UUID> {

    Optional<TechnologyComponentEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechnologyComponentEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndNameAndTypeAndDeletedAtIsNull(String tenantId, String name, String type);

    List<TechnologyComponentEntity> findByTenantIdAndTypeAndDeletedAtIsNull(String tenantId, String type);
}
