package com.metaplatform.ont.service;

import com.metaplatform.ont.config.LlmGwProperties;
import com.metaplatform.ont.dto.DataSourceDto;
import com.metaplatform.ont.dto.DiscoveryResponse;
import com.metaplatform.ont.dto.ImportRequest;
import com.metaplatform.ont.dto.SuggestRequest;
import com.metaplatform.ont.entity.OntologyDiscoveryEntity;
import com.metaplatform.ont.repository.OntologyDiscoveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 替代原 Python FastAPI ontology_discovery.py
 * 4 个端点：getDataSources / analyze / suggest / importCandidates
 * <p>
 * 设计说明：
 * <ul>
 *   <li>数据源目录（MOCK_CATALOG）使用 setter 显式构造，避免双括号初始化 anti-pattern；</li>
 *   <li>{@code suggest} 通过 SAA {@link ChatClient} 调用 LLM；</li>
 *   <li>{@code analyze} / {@code importCandidates} 将任务记录持久化到 ont_discovery_task；</li>
 *   <li>tenantId 由 Controller 显式传入（不在 Service 内从 TenantContext 取，便于解耦与测试）。</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyDiscoveryService {

    private final OntologyDiscoveryRepository repository;
    private final ChatClient.Builder chatClientBuilder;
    private final LlmGwProperties llmGwProperties;

    /**
     * 4 个固定数据源（mock_catalog）。使用 setter 显式构造，避免双括号初始化 anti-pattern。
     */
    private static final List<DataSourceDto> MOCK_CATALOG;

    static {
        DataSourceDto pg = new DataSourceDto();
        pg.setId("pg-prod");
        pg.setName("PostgreSQL Prod");
        pg.setType("POSTGRESQL");
        pg.setHost("pg.internal");
        pg.setPort(5432);
        pg.setDescription("Production PG");

        DataSourceDto mysql = new DataSourceDto();
        mysql.setId("mysql-crm");
        mysql.setName("MySQL CRM");
        mysql.setType("MYSQL");
        mysql.setHost("mysql.internal");
        mysql.setPort(3306);
        mysql.setDescription("CRM MySQL");

        DataSourceDto kafka = new DataSourceDto();
        kafka.setId("kafka-events");
        kafka.setName("Kafka Events");
        kafka.setType("KAFKA");
        kafka.setHost("kafka.internal");
        kafka.setPort(9092);
        kafka.setDescription("Event stream");

        DataSourceDto mongo = new DataSourceDto();
        mongo.setId("mongo-logs");
        mongo.setName("MongoDB Logs");
        mongo.setType("MONGODB");
        mongo.setHost("mongo.internal");
        mongo.setPort(27017);
        mongo.setDescription("Application logs");

        MOCK_CATALOG = Collections.unmodifiableList(Arrays.asList(pg, mysql, kafka, mongo));
    }

    /**
     * 返回 mock 数据源目录。
     */
    public List<DataSourceDto> getDataSources() {
        log.info("Returning {} mock data sources (model={})", MOCK_CATALOG.size(), llmGwProperties.getDefaultModel());
        return MOCK_CATALOG;
    }

    /**
     * 分析指定数据源的表结构（mock 实现），并将任务记录写入 DB。
     */
    @Transactional
    public DiscoveryResponse analyze(String tenantId, String sourceId, List<String> tables) {
        String taskId = UUID.randomUUID().toString();
        List<String> tableList = tables == null ? Collections.emptyList() : tables;

        OntologyDiscoveryEntity entity = OntologyDiscoveryEntity.builder()
                .id(taskId)
                .tenantId(tenantId)
                .sourceId(sourceId)
                .sourceType(findSourceType(sourceId))
                .status("COMPLETED")
                .resultJson("{\"tables\":" + tableList + "}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        repository.save(entity);

        return new DiscoveryResponse(taskId, "COMPLETED",
                Arrays.asList("customer", "order", "product"),
                "Analyzed " + tableList.size() + " tables from " + sourceId);
    }

    /**
     * 调用 SAA ChatClient，让 LLM 对现有概念/关系做语义建议。
     */
    public DiscoveryResponse suggest(String tenantId, String sourceId, SuggestRequest req) {
        ChatClient client = chatClientBuilder.build();
        List<String> concepts = req.getConcepts() == null ? Collections.emptyList() : req.getConcepts();
        List<String> relations = req.getRelations() == null ? Collections.emptyList() : req.getRelations();

        String prompt = "Given these concepts: " + concepts
                + " and relations: " + relations
                + ", suggest better naming and semantic relationships.";

        String response = client.prompt()
                .system("You are an ontology semantic expert. Return JSON list of suggestions.")
                .user(prompt)
                .call()
                .content();

        List<String> suggestions = new ArrayList<>();
        if (response != null && !response.isBlank()) {
            suggestions.add(response);
        }

        return new DiscoveryResponse(UUID.randomUUID().toString(), "COMPLETED",
                suggestions, "Suggestions generated");
    }

    /**
     * 导入候选概念（mock 实现），将任务写入 DB。
     */
    @Transactional
    public DiscoveryResponse importCandidates(String tenantId, ImportRequest req) {
        String taskId = UUID.randomUUID().toString();
        List<String> conceptIds = req.getConceptIds() == null ? Collections.emptyList() : req.getConceptIds();
        int imported = conceptIds.size();

        OntologyDiscoveryEntity entity = OntologyDiscoveryEntity.builder()
                .id(taskId)
                .tenantId(tenantId)
                .sourceId(req.getSourceId())
                .sourceType("IMPORT")
                .status("COMPLETED")
                .resultJson("{\"imported\":" + imported + "}")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        repository.save(entity);

        return new DiscoveryResponse(taskId, "COMPLETED",
                Collections.emptyList(), "Imported " + imported + " concepts");
    }

    private String findSourceType(String sourceId) {
        if (sourceId == null) {
            return "UNKNOWN";
        }
        return MOCK_CATALOG.stream()
                .filter(ds -> sourceId.equals(ds.getId()))
                .map(DataSourceDto::getType)
                .findFirst()
                .orElse("UNKNOWN");
    }
}