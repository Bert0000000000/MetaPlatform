package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.mfa.UserMfaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserMfaRepository extends JpaRepository<UserMfaEntity, String> {

    List<UserMfaEntity> findByUserId(String userId);

    Optional<UserMfaEntity> findByUserIdAndMfaType(String userId, UserMfaEntity.MfaType mfaType);

    boolean existsByUserIdAndMfaTypeAndEnabledTrueAndVerifiedTrue(String userId, UserMfaEntity.MfaType mfaType);

    boolean existsByUserIdAndEnabledTrueAndVerifiedTrue(String userId);
}
