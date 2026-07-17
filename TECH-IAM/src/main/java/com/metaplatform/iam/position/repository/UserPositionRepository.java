package com.metaplatform.iam.position.repository;

import com.metaplatform.iam.position.entity.UserPositionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserPositionRepository extends JpaRepository<UserPositionEntity, String> {

    List<UserPositionEntity> findByUserIdAndDeletedFalse(String userId);

    Optional<UserPositionEntity> findByUserIdAndPositionIdAndDepartmentIdAndDeletedFalse(
            String userId, String positionId, String departmentId);

    long countByUserIdAndIsPrimaryTrueAndDeletedFalse(String userId);
}