package com.metaplatform.dw.repository;

import com.metaplatform.dw.entity.KbBindingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface KbBindingRepository extends JpaRepository<KbBindingEntity, Long> {
    List<KbBindingEntity> findByEmployeeIdOrderByPriorityDesc(String employeeId);
    Optional<KbBindingEntity> findByEmployeeIdAndKbId(String employeeId, String kbId);
    void deleteByEmployeeIdAndKbId(String employeeId, String kbId);
}