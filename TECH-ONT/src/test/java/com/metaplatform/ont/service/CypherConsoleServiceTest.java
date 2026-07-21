package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.CypherExecuteRequest;
import com.metaplatform.ont.dto.CypherExecuteResponse;
import com.metaplatform.ont.dto.CypherTemplateCreateRequest;
import com.metaplatform.ont.dto.CypherTemplateResponse;
import com.metaplatform.ont.entity.CypherTemplateEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.CypherTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

import java.util.*;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * V12-05 测试：Cypher 控制台服务。
 * 覆盖：查询安全校验（READ-only / 多语句禁止 / 字面量剥离）、查询执行、模板 CRUD、分类列表。
 * 使用 Mockito.spy 覆盖 executeCypherQuery 方法，不连接真实 Neo4j。
 */
@ExtendWith(MockitoExtension.class)
class CypherConsoleServiceTest {

    @Mock
    private Neo4jClient neo4jClient;

    @Mock
    private CypherTemplateRepository cypherTemplateRepository;

    private CypherConsoleService cypherConsoleService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
        cypherConsoleService = Mockito.spy(new CypherConsoleService(neo4jClient, cypherTemplateRepository, objectMapper));
    }

    // ============================================================
    // sanitizeAndValidate
    // ============================================================

    @Test
    void sanitize_shouldRejectEmptyQuery() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate(""))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("为空");
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("   "))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("为空");
    }

    @Test
    void sanitize_shouldRejectMultiStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate(
                "MATCH (n) RETURN n; MATCH (m) RETURN m"))
                .isInstanceOf(OntException.class)
                .hasMessageContaining("一次只能执行一条语句");
    }

    @Test
    void sanitize_shouldRejectCreateStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("CREATE (n:Concept {name:'x'})"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectDeleteStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("MATCH (n) DELETE n"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectSetStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("MATCH (n) SET n.name='x'"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectCallStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("CALL db.labels() YIELD label RETURN label"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectForeachStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate(
                "MATCH (n) FOREACH (x IN [1,2] | SET n.x = x)"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldNotRejectCreateInsideStringLiteral() {
        // 字符串字面量内的 CREATE 不应被误判
        String cypher = "MATCH (n:Concept) WHERE n.name = 'CREATE TABLE foo' RETURN n";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).isEqualTo(cypher);
    }

    @Test
    void sanitize_shouldNotRejectCreateInsideLineComment() {
        String cypher = "MATCH (n:Concept) // CREATE (m)\nRETURN n";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).contains("MATCH (n:Concept)");
    }

    @Test
    void sanitize_shouldNotRejectCreateInsideBlockComment() {
        String cypher = "MATCH (n:Concept) /* CREATE (m) */ RETURN n";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).contains("MATCH (n:Concept)");
    }

    @Test
    void sanitize_shouldRejectIndexStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate(
                "CREATE INDEX FOR (n:Concept) ON (n.code)"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectMergeStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("MERGE (n:Concept {name:'x'}) RETURN n"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldRejectDropStatement() {
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("DROP INDEX idx"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void sanitize_shouldAcceptValidReadQuery() {
        String cypher = "MATCH (n:Concept) RETURN n.name AS name LIMIT 10";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).contains("MATCH (n:Concept)");
    }

    @Test
    void sanitize_shouldAcceptOptionalMatch() {
        String cypher = "OPTIONAL MATCH (n:Concept) RETURN n";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).startsWith("OPTIONAL MATCH");
    }

    @Test
    void sanitize_shouldAcceptWithStart() {
        String cypher = "WITH 1 AS x MATCH (n) RETURN n";
        String result = cypherConsoleService.sanitizeAndValidate(cypher);
        assertThat(result).startsWith("WITH");
    }

    @Test
    void sanitize_shouldRejectNonWhitelistedStart() {
        // 以 WITH/CASE/UNWIND 等非白名单起始应拒绝
        assertThatThrownBy(() -> cypherConsoleService.sanitizeAndValidate("UNWIND [1,2,3] AS x RETURN x"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_QUERY_INVALID);
    }

    // ============================================================
    // ensureLimit
    // ============================================================

    @Test
    void ensureLimit_shouldAppendWhenMissing() {
        String result = cypherConsoleService.ensureLimit("MATCH (n) RETURN n", 50);
        assertThat(result.trim()).endsWith("LIMIT 50");
    }

    @Test
    void ensureLimit_shouldNotAppendWhenAlreadyPresent() {
        String result = cypherConsoleService.ensureLimit("MATCH (n) RETURN n LIMIT 5", 50);
        assertThat(result.trim()).endsWith("LIMIT 5");
    }

    @Test
    void ensureLimit_shouldNotAppendWhenCaseInsensitive() {
        String result = cypherConsoleService.ensureLimit("MATCH (n) RETURN n limit 7", 50);
        assertThat(result.trim()).endsWith("limit 7");
    }

    // ============================================================
    // execute
    // ============================================================

    @Test
    void execute_shouldRunAndReturnColumnsAndRows() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("MATCH (n:Concept) RETURN n.name AS name, n.code AS code LIMIT 10");
        request.setLimit(10);

        List<Map<String, Object>> records = List.of(
                Map.of("name", "客户", "code", "C1"),
                Map.of("name", "供应商", "code", "C2")
        );

        doReturn(records).when(cypherConsoleService).executeCypherQuery(anyString(), anyMap());

        CypherExecuteResponse response = cypherConsoleService.execute(request);

        assertThat(response.getColumns()).containsExactly("name", "code");
        assertThat(response.getRows()).hasSize(2);
        assertThat(response.getRowCount()).isEqualTo(2);
        assertThat(response.getDurationMs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void execute_shouldRejectWhenQueryIsWrite() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("CREATE (n:Concept {name:'x'})");

        assertThatThrownBy(() -> cypherConsoleService.execute(request))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void execute_shouldEnforceMaxLimit() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("MATCH (n) RETURN n");
        request.setLimit(99999);

        doReturn(List.of()).when(cypherConsoleService).executeCypherQuery(anyString(), anyMap());

        cypherConsoleService.execute(request);
        // 服务端强制 LIMIT 应被截断到 1000
        verify(cypherConsoleService).executeCypherQuery(endsWith("LIMIT 1000"), anyMap());
    }

    @Test
    void execute_shouldNotAppendLimitWhenUserProvided() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("MATCH (n) RETURN n LIMIT 5");
        request.setLimit(100);

        doReturn(List.of()).when(cypherConsoleService).executeCypherQuery(anyString(), anyMap());

        cypherConsoleService.execute(request);
        verify(cypherConsoleService).executeCypherQuery(endsWith("LIMIT 5"), anyMap());
    }

    @Test
    void execute_shouldTruncateRowsBeyondLimit() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("MATCH (n) RETURN n");
        request.setLimit(3);

        List<Map<String, Object>> records = List.of(
                Map.of("n", 1),
                Map.of("n", 2),
                Map.of("n", 3),
                Map.of("n", 4),
                Map.of("n", 5)
        );
        doReturn(records).when(cypherConsoleService).executeCypherQuery(anyString(), anyMap());

        CypherExecuteResponse response = cypherConsoleService.execute(request);
        assertThat(response.getRowCount()).isEqualTo(3);
    }

    @Test
    void execute_shouldWrapNeo4jFailureAsNeo4jError() {
        CypherExecuteRequest request = new CypherExecuteRequest();
        request.setQuery("MATCH (n) RETURN n");

        doThrow(new RuntimeException("syntax error"))
                .when(cypherConsoleService).executeCypherQuery(anyString(), anyMap());

        assertThatThrownBy(() -> cypherConsoleService.execute(request))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.NEO4J_ERROR);
    }

    // ============================================================
    // Template CRUD
    // ============================================================

    @Test
    void createTemplate_shouldPersist() {
        CypherTemplateCreateRequest req = new CypherTemplateCreateRequest();
        req.setName("概念列表");
        req.setCategory("concept");
        req.setDescription("查询所有概念");
        req.setQuery("MATCH (n:Concept) RETURN n.name AS name");
        req.setTags(List.of("basic", "concept"));

        when(cypherTemplateRepository.existsByTenantIdAndName(TenantContext.DEFAULT_TENANT_ID, "概念列表"))
                .thenReturn(false);
        when(cypherTemplateRepository.save(any(CypherTemplateEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CypherTemplateResponse resp = cypherConsoleService.createTemplate(req);
        assertThat(resp.getName()).isEqualTo("概念列表");
        assertThat(resp.getCategory()).isEqualTo("concept");
        assertThat(resp.getTags()).containsExactly("basic", "concept");
    }

    @Test
    void createTemplate_shouldRejectDuplicateName() {
        CypherTemplateCreateRequest req = new CypherTemplateCreateRequest();
        req.setName("重复模板");
        req.setCategory("relation");
        req.setQuery("MATCH (n)-[r]->(m) RETURN n, r, m");
        when(cypherTemplateRepository.existsByTenantIdAndName(TenantContext.DEFAULT_TENANT_ID, "重复模板"))
                .thenReturn(true);

        assertThatThrownBy(() -> cypherConsoleService.createTemplate(req))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_TEMPLATE_ALREADY_EXISTS);
    }

    @Test
    void createTemplate_shouldRejectInvalidQuery() {
        CypherTemplateCreateRequest req = new CypherTemplateCreateRequest();
        req.setName("非法模板");
        req.setCategory("concept");
        req.setQuery("DELETE (n)");

        when(cypherTemplateRepository.existsByTenantIdAndName(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> cypherConsoleService.createTemplate(req))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_WRITE_FORBIDDEN);
    }

    @Test
    void listTemplates_shouldFilterByCategory() {
        CypherTemplateEntity entity = CypherTemplateEntity.builder()
                .templateId("tpl-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("模板1")
                .category("concept")
                .query("MATCH (n) RETURN n")
                .tags(objectMapper.valueToTree(List.of("a")))
                .builtin(false)
                .build();

        when(cypherTemplateRepository.findByTenantIdAndCategoryOrderByUpdatedAtDesc(
                TenantContext.DEFAULT_TENANT_ID, "concept"))
                .thenReturn(List.of(entity));

        List<CypherTemplateResponse> result = cypherConsoleService.listTemplates("concept", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCategory()).isEqualTo("concept");
    }

    @Test
    void listTemplates_shouldFilterByKeyword() {
        CypherTemplateEntity e1 = CypherTemplateEntity.builder()
                .templateId("t1").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("客户概念").category("concept")
                .query("MATCH (n:Concept) RETURN n")
                .tags(objectMapper.valueToTree(List.of()))
                .build();
        CypherTemplateEntity e2 = CypherTemplateEntity.builder()
                .templateId("t2").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("供应商").category("concept")
                .query("MATCH (n:Concept) RETURN n")
                .tags(objectMapper.valueToTree(List.of()))
                .build();

        when(cypherTemplateRepository.findByTenantIdOrderByUpdatedAtDesc(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(List.of(e1, e2));

        List<CypherTemplateResponse> result = cypherConsoleService.listTemplates(null, "客户");
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("客户概念");
    }

    @Test
    void updateTemplate_shouldRejectMissingTemplate() {
        CypherTemplateCreateRequest req = new CypherTemplateCreateRequest();
        req.setName("x");
        req.setCategory("path");
        req.setQuery("MATCH p=(n)-[*1..3]->(m) RETURN p");

        when(cypherTemplateRepository.findByTemplateIdAndTenantId("nope", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> cypherConsoleService.updateTemplate("nope", req))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.CYPHER_TEMPLATE_NOT_FOUND);
    }

    @Test
    void updateTemplate_shouldRejectBuiltin() {
        CypherTemplateEntity entity = CypherTemplateEntity.builder()
                .templateId("tpl-builtin")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("内置")
                .category("concept")
                .query("MATCH (n) RETURN n")
                .builtin(true)
                .build();

        when(cypherTemplateRepository.findByTemplateIdAndTenantId("tpl-builtin", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        CypherTemplateCreateRequest req = new CypherTemplateCreateRequest();
        req.setName("修改内置");
        req.setCategory("concept");
        req.setQuery("MATCH (n) RETURN n LIMIT 1");

        assertThatThrownBy(() -> cypherConsoleService.updateTemplate("tpl-builtin", req))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.PERMISSION_DENIED);
    }

    @Test
    void deleteTemplate_shouldRejectBuiltin() {
        CypherTemplateEntity entity = CypherTemplateEntity.builder()
                .templateId("tpl-builtin")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("内置")
                .category("concept")
                .query("MATCH (n) RETURN n")
                .builtin(true)
                .build();

        when(cypherTemplateRepository.findByTemplateIdAndTenantId("tpl-builtin", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> cypherConsoleService.deleteTemplate("tpl-builtin"))
                .isInstanceOf(OntException.class)
                .extracting(e -> ((OntException) e).getErrorCode())
                .isEqualTo(ErrorCode.PERMISSION_DENIED);
    }

    @Test
    void deleteTemplate_shouldDelete() {
        CypherTemplateEntity entity = CypherTemplateEntity.builder()
                .templateId("tpl-1")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name("普通模板")
                .category("concept")
                .query("MATCH (n) RETURN n")
                .builtin(false)
                .build();

        when(cypherTemplateRepository.findByTemplateIdAndTenantId("tpl-1", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        cypherConsoleService.deleteTemplate("tpl-1");
        verify(cypherTemplateRepository).delete(entity);
    }

    @Test
    void listCategories_shouldReturnDistinctSorted() {
        CypherTemplateEntity e1 = tpl("a", "relation");
        CypherTemplateEntity e2 = tpl("b", "concept");
        CypherTemplateEntity e3 = tpl("c", "aggregate");
        CypherTemplateEntity e4 = tpl("d", "concept");

        when(cypherTemplateRepository.findByTenantIdOrderByUpdatedAtDesc(TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(List.of(e1, e2, e3, e4));

        List<String> cats = cypherConsoleService.listCategories();
        assertThat(cats).containsExactly("aggregate", "concept", "relation");
    }

    @Test
    void stripLiteralsAndComments_shouldHandleEscapedQuote() {
        String input = "MATCH (n) WHERE n.name = 'O\\'Brien' RETURN n // comment";
        String stripped = cypherConsoleService.stripLiteralsAndComments(input);
        assertThat(stripped).doesNotContain("O'Brien");
        assertThat(stripped).doesNotContain("comment");
    }

    @Test
    void stripLiteralsAndComments_shouldHandleDoubleQuotes() {
        String input = "MATCH (n) WHERE n.desc = \"CREATE INDEX\" RETURN n";
        String stripped = cypherConsoleService.stripLiteralsAndComments(input);
        // 字面量内 CREATE INDEX 已被剥离，不应再触发禁止关键字
        assertThat(stripped).doesNotContain("CREATE INDEX");
    }

    @Test
    void toJsonNode_shouldSerializeTagsList() {
        JsonNode node = objectMapper.valueToTree(List.of("a", "b"));
        assertThat(node.isArray()).isTrue();
        assertThat(StreamSupport.stream(node.spliterator(), false).count()).isEqualTo(2);
    }

    private CypherTemplateEntity tpl(String id, String category) {
        return CypherTemplateEntity.builder()
                .templateId(id)
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .name(id)
                .category(category)
                .query("MATCH (n) RETURN n")
                .tags(objectMapper.valueToTree(List.of()))
                .builtin(false)
                .build();
    }
}
