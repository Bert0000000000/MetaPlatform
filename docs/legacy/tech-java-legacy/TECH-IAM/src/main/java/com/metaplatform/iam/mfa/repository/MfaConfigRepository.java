package com.metaplatform.iam.mfa.repository;

import com.metaplatform.iam.mfa.entity.MfaConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MfaConfigRepository extends JpaRepository<MfaConfigEntity, String> {

    Optional<MfaConfigEntity> findByTenantIdAndUserIdAndMfaType(String tenantId, String userId, MfaConfigEntity.MfaType mfaType);

    List<MfaConfigEntity> findByUserId(String userId);

    List<MfaConfigEntity> findByUserIdAndEnabledTrue(String userId);

    boolean existsByUserIdAndEnabledTrue(String userId);
}
