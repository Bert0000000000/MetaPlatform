package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, String> {

    Optional<UserEntity> findByTenantIdAndUsername(String tenantId, String username);

    Optional<UserEntity> findByTenantIdAndEmail(String tenantId, String email);

    boolean existsByTenantIdAndUsername(String tenantId, String username);

    boolean existsByTenantIdAndEmail(String tenantId, String email);
}
