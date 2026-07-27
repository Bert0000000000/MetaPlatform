package com.metaplatform.agent.runs;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@TestPropertySource(properties={"spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=create-drop"})
class AgentRunRepositoryTest {
 @Autowired AgentRunRepository repository;
 @Test void crudAndCustomQueries(){
  Instant old=Instant.parse("2026-01-01T00:00:00Z"), recent=Instant.parse("2026-07-01T00:00:00Z");
  repository.save(AgentRunEntity.builder().runId("run-1").tenantId("t").userId("u").agentId("a").runtimeType("DEERFLOW").status("RUNNING").goal("g").budget("{}").traceId("tr").createdAt(old).updatedAt(old).build());
  assertThat(repository.findById("run-1")).isPresent();
  assertThat(repository.findByTenantIdAndUserIdAndCreatedAtAfterOrderByCreatedAtDesc("t","u",old.minusSeconds(1))).hasSize(1);
  assertThat(repository.findByRunIdAndStatusIn("run-1", List.of("RUNNING"))).isPresent();
  assertThat(repository.findStaleRuns(recent)).hasSize(1);
 }
}
