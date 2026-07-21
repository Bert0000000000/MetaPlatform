package com.metaplatform.rule.testcase.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleExecutionResult;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.service.RuleExecutionService;
import com.metaplatform.rule.testcase.dto.CreateTestCaseRequest;
import com.metaplatform.rule.testcase.dto.TestCaseResponse;
import com.metaplatform.rule.testcase.dto.TestCaseStatistics;
import com.metaplatform.rule.testcase.dto.TestRunRequestDto;
import com.metaplatform.rule.testcase.dto.TestRunResultDto;
import com.metaplatform.rule.testcase.dto.UpdateTestCaseRequest;
import com.metaplatform.rule.testcase.entity.TestCaseEntity;
import com.metaplatform.rule.testcase.repository.TestCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final RuleExecutionService ruleExecutionService;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TestCaseResponse create(CreateTestCaseRequest request) {
        String tenantId = TenantContext.get();

        if (StringUtils.hasText(request.getRuleId())) {
            ruleDefinitionRepository.findByIdAndDeletedFalse(request.getRuleId())
                    .orElseThrow(() -> new RuleException(ErrorCode.RULE_NOT_FOUND));
        }

        TestCaseEntity entity = TestCaseEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .ruleId(request.getRuleId())
                .rulesetId(request.getRulesetId())
                .targetType(request.getTargetType())
                .targetId(request.getTargetId())
                .name(request.getName())
                .input(writeJson(request.getInput()))
                .expectedOutput(writeJson(request.getExpectedOutput()))
                .status("PENDING")
                .build();

        return toResponse(testCaseRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TestCaseResponse> list(String rulesetId) {
        String tenantId = TenantContext.get();
        List<TestCaseEntity> entities = StringUtils.hasText(rulesetId)
                ? testCaseRepository.findByTenantIdAndRulesetId(tenantId, rulesetId)
                : testCaseRepository.findByTenantId(tenantId);
        return entities.stream().map(this::toResponse).toList();
    }

    /**
     * V11-03：扩展列表查询，支持 ruleId / targetType / targetId 多维度过滤。
     *
     * <p>参数为空时不过滤；多个参数同时存在时按 AND 组合。
     */
    @Transactional(readOnly = true)
    public List<TestCaseResponse> list(String ruleId, String targetType, String targetId, String rulesetId) {
        String tenantId = TenantContext.get();

        // 优先走索引化的查询路径
        if (StringUtils.hasText(targetType) && StringUtils.hasText(targetId)) {
            List<TestCaseEntity> entities = testCaseRepository
                    .findByTenantIdAndTargetTypeAndTargetId(tenantId, targetType, targetId);
            return entities.stream()
                    .filter(e -> !StringUtils.hasText(ruleId) || ruleId.equals(e.getRuleId()))
                    .filter(e -> !StringUtils.hasText(rulesetId) || rulesetId.equals(e.getRulesetId()))
                    .map(this::toResponse)
                    .toList();
        }

        if (StringUtils.hasText(rulesetId)) {
            return testCaseRepository.findByTenantIdAndRulesetId(tenantId, rulesetId).stream()
                    .filter(e -> !StringUtils.hasText(ruleId) || ruleId.equals(e.getRuleId()))
                    .map(this::toResponse)
                    .toList();
        }

        if (StringUtils.hasText(ruleId)) {
            return testCaseRepository.findByTenantId(tenantId).stream()
                    .filter(e -> ruleId.equals(e.getRuleId()))
                    .map(this::toResponse)
                    .toList();
        }

        return testCaseRepository.findByTenantId(tenantId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TestCaseResponse getById(String id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TestCaseResponse update(String id, UpdateTestCaseRequest request) {
        TestCaseEntity entity = findById(id);
        if (request.getName() != null) entity.setName(request.getName());
        if (request.getTargetType() != null) entity.setTargetType(request.getTargetType());
        if (request.getTargetId() != null) entity.setTargetId(request.getTargetId());
        if (request.getInput() != null) entity.setInput(writeJson(request.getInput()));
        if (request.getExpectedOutput() != null) entity.setExpectedOutput(writeJson(request.getExpectedOutput()));
        entity.setStatus("PENDING");
        return toResponse(testCaseRepository.save(entity));
    }

    @Transactional
    public void delete(String id) {
        TestCaseEntity entity = findById(id);
        testCaseRepository.delete(entity);
    }

    @Transactional
    public TestCaseResponse run(String id) {
        TestCaseEntity entity = findById(id);
        Map<String, Object> input = readMap(entity.getInput());
        Map<String, Object> expected = readMap(entity.getExpectedOutput());

        try {
            List<RuleExecutionResult> results = ruleExecutionService.execute(entity.getRulesetId(), input);

            Map<String, Object> actual;
            if (StringUtils.hasText(entity.getRuleId())) {
                actual = results.stream()
                        .filter(r -> entity.getRuleId().equals(r.getRuleId()))
                        .findFirst()
                        .map(r -> r.getAction() != null ? r.getAction().getConfig() : Map.<String, Object>of("matched", r.isMatched()))
                        .orElse(Map.of("matched", false));
            } else {
                actual = Map.of("results", results.stream()
                        .map(r -> Map.of("ruleId", r.getRuleId(), "matched", r.isMatched()))
                        .toList());
            }

            entity.setActualOutput(writeJson(actual));
            boolean pass = expected == null || expected.isEmpty() || compareOutput(expected, actual);
            entity.setStatus(pass ? "PASS" : "FAIL");
        } catch (Exception e) {
            log.warn("Test case run failed: id={}, error={}", id, e.getMessage());
            entity.setActualOutput(writeJson(Map.of("error", e.getMessage())));
            entity.setStatus("FAIL");
        }

        return toResponse(testCaseRepository.save(entity));
    }

    @Transactional
    public List<TestCaseResponse> batchRun(String rulesetId) {
        String tenantId = TenantContext.get();
        List<TestCaseEntity> cases = testCaseRepository.findByTenantIdAndRulesetId(tenantId, rulesetId);
        return cases.stream().map(tc -> run(tc.getId())).toList();
    }

    /**
     * V11-03：批量运行测试用例并返回聚合结果。
     *
     * <p>支持以下过滤维度（任一组合）：
     * <ul>
     *   <li>{@code testCaseIds} - 显式指定用例 ID 列表</li>
     *   <li>{@code ruleId} - 按规则 ID 过滤</li>
     *   <li>{@code targetType} + {@code targetId} - 按目标过滤</li>
     * </ul>
     *
     * <p>返回的 {@link TestRunResultDto} 与前端 {@code TestRun} 类型对齐：
     * 当 {@code targetType == "DECISION_TABLE"} 时填充 {@code decisionTableId} 字段。
     */
    @Transactional
    public TestRunResultDto runBatch(TestRunRequestDto request) {
        String tenantId = TenantContext.get();
        Instant startedAt = Instant.now();

        // 选取目标用例
        List<TestCaseEntity> candidates;
        if (request.getTestCaseIds() != null && !request.getTestCaseIds().isEmpty()) {
            candidates = testCaseRepository.findAllById(request.getTestCaseIds()).stream()
                    .filter(e -> tenantId.equals(e.getTenantId()))
                    .toList();
        } else if (StringUtils.hasText(request.getTargetType()) && StringUtils.hasText(request.getTargetId())) {
            candidates = testCaseRepository.findByTenantIdAndTargetTypeAndTargetId(
                    tenantId, request.getTargetType(), request.getTargetId());
        } else if (StringUtils.hasText(request.getRuleId())) {
            candidates = testCaseRepository.findByTenantId(tenantId).stream()
                    .filter(e -> request.getRuleId().equals(e.getRuleId()))
                    .toList();
        } else {
            candidates = testCaseRepository.findByTenantId(tenantId);
        }

        // 逐条运行（复用 run(id) 单条逻辑）
        List<TestCaseResponse> results = candidates.stream()
                .map(tc -> run(tc.getId()))
                .toList();

        int passed = (int) results.stream().filter(r -> "PASS".equalsIgnoreCase(r.getStatus())).count();
        int failed = (int) results.stream().filter(r -> "FAIL".equalsIgnoreCase(r.getStatus())).count();
        int errored = (int) results.stream().filter(r -> "ERROR".equalsIgnoreCase(r.getStatus())).count();

        String decisionTableId = "DECISION_TABLE".equalsIgnoreCase(request.getTargetType())
                ? request.getTargetId()
                : null;

        return TestRunResultDto.builder()
                .id("tr-" + UUID.randomUUID())
                .ruleId(request.getRuleId())
                .decisionTableId(decisionTableId)
                .startedAt(startedAt)
                .finishedAt(Instant.now())
                .totalCases(results.size())
                .passedCount(passed)
                .failedCount(failed)
                .errorCount(errored)
                .results(results)
                .build();
    }

    @Transactional(readOnly = true)
    public TestCaseStatistics statistics() {
        String tenantId = TenantContext.get();
        long total = testCaseRepository.findByTenantId(tenantId).size();
        long passed = testCaseRepository.countByTenantIdAndStatus(tenantId, "PASS");
        long failed = testCaseRepository.countByTenantIdAndStatus(tenantId, "FAIL");
        long pending = testCaseRepository.countByTenantIdAndStatus(tenantId, "PENDING");
        double passRate = total > 0 ? (double) passed / total * 100 : 0;
        return TestCaseStatistics.builder()
                .total(total)
                .passed(passed)
                .failed(failed)
                .pending(pending)
                .passRate(passRate)
                .build();
    }

    private TestCaseEntity findById(String id) {
        String tenantId = TenantContext.get();
        TestCaseEntity entity = testCaseRepository.findById(id)
                .orElseThrow(() -> new RuleException(ErrorCode.TEST_CASE_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private boolean compareOutput(Map<String, Object> expected, Map<String, Object> actual) {
        for (Map.Entry<String, Object> entry : expected.entrySet()) {
            if (!Objects.equals(entry.getValue(), actual.get(entry.getKey()))) {
                return false;
            }
        }
        return true;
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuleException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private TestCaseResponse toResponse(TestCaseEntity entity) {
        return TestCaseResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .ruleId(entity.getRuleId())
                .rulesetId(entity.getRulesetId())
                .targetType(entity.getTargetType())
                .targetId(entity.getTargetId())
                .name(entity.getName())
                .input(readMap(entity.getInput()))
                .expectedOutput(readMap(entity.getExpectedOutput()))
                .actualOutput(readMap(entity.getActualOutput()))
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
