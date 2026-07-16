package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.IamOutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IamOutboxRepository extends JpaRepository<IamOutboxEntity, String> {

    /**
     * 查询所有指定状态的消息，按创建时间升序排列（FIFO 投递）。
     */
    List<IamOutboxEntity> findByStatusOrderByCreatedAtAsc(String status);
}
