package com.metaplatform.ea.process.repository;

import com.metaplatform.ea.process.entity.BusinessProcessVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessProcessVersionRepository
        extends JpaRepository<BusinessProcessVersionEntity, UUID> {

    List<BusinessProcessVersionEntity> findByProcessIdOrderByVersionDesc(UUID processId);

    Optional<BusinessProcessVersionEntity> findByProcessIdAndVersion(UUID processId, Integer version);
}