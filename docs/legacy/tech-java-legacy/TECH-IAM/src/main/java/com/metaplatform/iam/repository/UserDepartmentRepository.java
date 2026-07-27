package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.UserDepartmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserDepartmentRepository extends JpaRepository<UserDepartmentEntity, String> {

    List<UserDepartmentEntity> findByUserIdAndDeletedFalse(String userId);

    Optional<UserDepartmentEntity> findByUserIdAndDepartmentIdAndDeletedFalse(String userId, String departmentId);

    long countByUserIdAndIsPrimaryTrueAndDeletedFalse(String userId);
}