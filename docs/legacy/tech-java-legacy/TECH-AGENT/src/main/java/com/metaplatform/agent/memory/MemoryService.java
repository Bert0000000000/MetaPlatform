package com.metaplatform.agent.memory;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Memory Service（P7.3）。
 *
 * <p>负责企业长期记忆的存取与 PII 检测。写入前必须：</p>
 * <ul>
 *   <li>PII 检测（身份证 / 手机号 / 银行卡 / 邮箱）</li>
 *   <li>租户隔离</li>
 *   <li>用户可查看 / 删除</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemoryService {

    private final MemoryRepository repository;

    public MemoryEntity write(String tenantId, String scope, String memoryKind,
                               String content, List<String> tags, String sourceRunId) {
        boolean pii = detectPii(content);
        MemoryEntity m = MemoryEntity.builder()
                .id("MEM-" + UUID.randomUUID())
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .memoryKind(memoryKind)
                .scope(scope)
                .content(pii ? redact(content) : content)
                .tags(tags == null ? null : tags.toString())
                .sourceRunId(sourceRunId)
                .confidence(1.0)
                .piiRedacted(pii)
                .createdAt(Instant.now())
                .createdBy("system")
                .build();
        return repository.save(m);
    }

    public List<MemoryEntity> recall(String tenantId, String scope, String memoryKind) {
        return repository.findByTenantIdAndScopeAndMemoryKindOrderByCreatedAtDesc(
                tenantId, scope, memoryKind);
    }

    public void delete(String id, String tenantId) {
        MemoryEntity m = repository.findById(id).orElseThrow();
        if (!m.getTenantId().equals(tenantId)) {
            throw new SecurityException("跨租户删除被阻止");
        }
        repository.deleteById(id);
    }

    private boolean detectPii(String s) {
        if (s == null) return false;
        return s.matches(".*\\d{17}[\\dXx].*")     // 身份证
                || s.matches(".*1[3-9]\\d{9}.*")     // 手机号
                || s.matches(".*\\d{16,19}.*")        // 银行卡
                || s.matches(".*[a-zA-Z0-9]+@[a-zA-Z0-9]+\\..*"); // 邮箱
    }

    private String redact(String s) {
        return s.replaceAll("\\d{17}[\\dXx]", "***ID_REDACTED***")
                .replaceAll("1[3-9]\\d{9}", "***PHONE_REDACTED***")
                .replaceAll("\\d{16,19}", "***CARD_REDACTED***")
                .replaceAll("[a-zA-Z0-9]+@[a-zA-Z0-9]+\\.[a-zA-Z]+", "***EMAIL_REDACTED***");
    }
}
