package com.metaplatform.ea.techstack.repository;

import com.metaplatform.ea.techstack.entity.TechnologyStackEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechnologyStackRepository extends JpaRepository<TechnologyStackEntity, UUID> {

    Optional<TechnologyStackEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechnologyStackEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);
}
