package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.UserRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRoleRepository extends JpaRepository<UserRoleEntity, String> {

    List<UserRoleEntity> findByUserIdAndDeletedFalse(String userId);

    Optional<UserRoleEntity> findByUserIdAndRoleIdAndDeletedFalse(String userId, String roleId);

    boolean existsByUserIdAndRoleIdAndDeletedFalse(String userId, String roleId);
}