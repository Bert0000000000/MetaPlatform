package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.UserSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSessionEntity, String> {

    List<UserSessionEntity> findByUserIdOrderByLastActiveAtDesc(String userId);
}
