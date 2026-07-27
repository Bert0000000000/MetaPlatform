package com.metaplatform.ont.diff;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VersionDiffRepository extends JpaRepository<VersionDiffEntity, String> {

    List<VersionDiffEntity> findByTenantIdAndToVersionOrderByCreatedAtDesc(String tenantId, String toVersion);

    List<VersionDiffEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}
