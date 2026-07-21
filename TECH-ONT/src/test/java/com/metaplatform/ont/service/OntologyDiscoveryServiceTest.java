package com.metaplatform.ont.service;

import com.metaplatform.ont.config.LlmGwProperties;
import com.metaplatform.ont.dto.DataSourceDto;
import com.metaplatform.ont.dto.DiscoveryResponse;
import com.metaplatform.ont.dto.ImportRequest;
import com.metaplatform.ont.dto.SuggestRequest;
import com.metaplatform.ont.entity.OntologyDiscoveryEntity;
import com.metaplatform.ont.repository.OntologyDiscoveryRepository;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OntologyDiscoveryServiceTest {

    @Mock
    private OntologyDiscoveryRepository repository;

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock
    private LlmGwProperties llmGwProperties;

    @InjectMocks
    private OntologyDiscoveryService service;

    @Test
    void getDataSources_returnsMockCatalog() {
        List<DataSourceDto> result = service.getDataSources();

        assertThat(result).hasSize(4);
        assertThat(result).extracting(DataSourceDto::getType)
                .containsExactly("POSTGRESQL", "MYSQL", "KAFKA", "MONGODB");
        assertThat(result).extracting(DataSourceDto::getId)
                .containsExactly("pg-prod", "mysql-crm", "kafka-events", "mongo-logs");
    }

    @Test
    void analyze_savesTaskAndReturnsResponse() {
        when(repository.save(any(OntologyDiscoveryEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        DiscoveryResponse result = service.analyze("tenant1", "pg-prod", List.of("users", "orders"));

        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getTaskId()).isNotBlank();
        assertThat(result.getMessage()).contains("2 tables").contains("pg-prod");

        ArgumentCaptor<OntologyDiscoveryEntity> captor = ArgumentCaptor.forClass(OntologyDiscoveryEntity.class);
        verify(repository).save(captor.capture());
        OntologyDiscoveryEntity saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("tenant1");
        assertThat(saved.getSourceId()).isEqualTo("pg-prod");
        assertThat(saved.getSourceType()).isEqualTo("POSTGRESQL");
        assertThat(saved.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void importCandidates_savesImportTask() {
        when(repository.save(any(OntologyDiscoveryEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        ImportRequest req = new ImportRequest();
        req.setSourceId("pg-prod");
        req.setConceptIds(List.of("c1", "c2", "c3"));

        DiscoveryResponse result = service.importCandidates("tenant1", req);

        assertThat(result.getStatus()).isEqualTo("COMPLETED");
        assertThat(result.getMessage()).contains("Imported 3 concepts");

        ArgumentCaptor<OntologyDiscoveryEntity> captor = ArgumentCaptor.forClass(OntologyDiscoveryEntity.class);
        verify(repository).save(captor.capture());
        OntologyDiscoveryEntity saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("tenant1");
        assertThat(saved.getSourceId()).isEqualTo("pg-prod");
        assertThat(saved.getSourceType()).isEqualTo("IMPORT");
    }

    /**
     * suggest() 需要 mock 整个 ChatClient 链
     * （Builder → ChatClient → prompt → call → content）。
     * 真实测试建议使用 @SpringBootTest + Testcontainers 或 MockBean。
     * 这里使用 @Disabled 占位。
     */
    @Test
    @Disabled("SAA ChatClient 链难以 mock，建议用 @SpringBootTest + Testcontainers 集成测试")
    void suggest_returnsGeneratedResponse() {
        SuggestRequest req = new SuggestRequest();
        req.setConcepts(List.of("Customer"));
        req.setRelations(List.of("has"));

        DiscoveryResponse result = service.suggest("tenant1", "pg-prod", req);

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo("COMPLETED");
    }
}
