package com.metaplatform.msg.repository;

import com.metaplatform.msg.entity.ConsumerGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConsumerGroupRepository extends JpaRepository<ConsumerGroupEntity, String> {

    Optional<ConsumerGroupEntity> findByTenantIdAndGroupIdAndTopicName(String tenantId, String groupId, String topicName);

    boolean existsByTenantIdAndGroupIdAndTopicName(String tenantId, String groupId, String topicName);
}
