package com.metaplatform.agent.action; import org.springframework.data.jpa.repository.JpaRepository; import java.time.Instant; import java.util.*; public interface ActionProposalRepository extends JpaRepository<ActionProposalEntity,String>{
    Optional<ActionProposalEntity> findByIdempotencyKey(String key);
    List<ActionProposalEntity> findByStatusAndExpiresAtBefore(ActionProposalStatus status, Instant before);
    @org.springframework.data.jpa.repository.Query("select a from ActionProposalEntity a where a.status = :status and a.expiresAt < :before")
    List<ActionProposalEntity> findByStatusAndExpiresAtBefore(@org.springframework.data.repository.query.Param("status") String status, @org.springframework.data.repository.query.Param("before") Instant before);
}
