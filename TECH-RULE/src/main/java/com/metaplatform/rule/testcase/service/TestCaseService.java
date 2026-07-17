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
import com.metaplatform.rule.testcase.dto.UpdateTestCaseRequest;
import com.metaplatform.rule.testcase.entity.TestCaseEntity;
import com.metaplatform.rule.testcase.repository.TestCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
                        .map(r -> r.getAction() != null ? r.getAction().getConfig() : Map.of("matched", r.isMatched()))
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
