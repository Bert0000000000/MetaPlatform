package com.metaplatform.ea.valuestream.repository;

import com.metaplatform.ea.valuestream.entity.ValueStreamCapabilityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ValueStreamCapabilityRepository extends JpaRepository<ValueStreamCapabilityEntity, UUID> {

    List<ValueStreamCapabilityEntity> findByValueStreamId(UUID valueStreamId);

    void deleteByValueStreamId(UUID valueStreamId);
}
