package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.UserSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserSettingsRepository extends JpaRepository<UserSettingsEntity, String> {

    Optional<UserSettingsEntity> findByUserId(String userId);
}
