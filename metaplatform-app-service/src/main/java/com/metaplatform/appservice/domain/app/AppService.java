package com.metaplatform.appservice.domain.app;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 应用领域服务 —— Sprint 0 范围：CRUD + 跨租户隔离 + 乐观锁。
 */
@Service
public class AppService {

    /**
     * 应用 code 规则：2-64 位，小写字母/数字/下划线/连字符，首字符必须是字母。
     * 允许连字符是为了兼容旧版 Node 后端生成的 slug（如 app-crm），过渡期后可视情况收紧。
     */
    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_-]{1,63}$");
    private final AppRepository repository;

    public AppService(AppRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<AppEntity> list() {
        return repository.findByTenantIdAndStatus(TenantContext.required(), "active");
    }

    @Transactional(readOnly = true)
    public AppEntity get(Long id) {
        return repository.findByIdAndTenantId(id, TenantContext.required())
                .orElseThrow(() -> ApiException.notFound("应用 " + id + " 不存在或无权访问"));
    }

    @Transactional(readOnly = true)
    public AppEntity getByCode(String code) {
        return repository.findByTenantIdAndCode(TenantContext.required(), code)
                .orElseThrow(() -> ApiException.notFound("应用 " + code + " 不存在或无权访问"));
    }

    /**
     * 按数字 ID 或 code（字符串 slug）解析应用。用于前端 URL 中的 appId 兼容旧版 Node ID。
     */
    @Transactional(readOnly = true)
    public AppEntity resolveByIdOrCode(String ref) {
        if (ref == null || ref.isBlank()) {
            throw ApiException.badRequest("应用标识不能为空");
        }
        try {
            return get(Long.valueOf(ref));
        } catch (NumberFormatException ignored) {
            return getByCode(ref);
        }
    }

    /**
     * 按 code 获取应用；不存在时自动创建一个占位应用（迁移过渡期兜底）。
     */
    @Transactional
    public AppEntity ensureByCode(String code) {
        if (code == null || code.isBlank()) {
            throw ApiException.badRequest("应用 code 不能为空");
        }
        return repository.findByTenantIdAndCode(TenantContext.required(), code)
                .orElseGet(() -> {
                    AppEntity app = new AppEntity();
                    app.setTenantId(TenantContext.required());
                    app.setCode(code);
                    app.setName(code);
                    app.setStatus("active");
                    app.setVersion(1);
                    app.setCreatedBy("migration");
                    return repository.save(app);
                });
    }

    @Transactional
    public AppEntity create(AppEntity input) {
        validateCode(input.getCode());
        validateRequiredName(input.getName());
        input.setTenantId(TenantContext.required());
        input.setStatus("active");
        input.setVersion(1);
        try {
            return repository.save(input);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("应用 code 已存在: " + input.getCode());
        }
    }

    @Transactional
    public AppEntity update(Long id, Integer expectedVersion, AppEntity patch) {
        AppEntity exists = get(id);
        if (!java.util.Objects.equals(expectedVersion, exists.getVersion())) {
            throw ApiException.conflict(
                "版本号过期（expected=" + expectedVersion + ", actual=" + exists.getVersion() + "）");
        }
        if (patch.getName() != null) validateRequiredName(patch.getName());
        if (patch.getName() != null) exists.setName(patch.getName());
        if (patch.getIcon() != null) exists.setIcon(patch.getIcon());
        if (patch.getDescription() != null) exists.setDescription(patch.getDescription());
        exists.setVersion(exists.getVersion() + 1);
        return repository.save(exists);
    }

    @Transactional
    public void archive(Long id) {
        AppEntity exists = get(id);
        exists.archive();
        exists.setVersion(exists.getVersion() + 1);
        repository.save(exists);
    }

    // —— 校验 —— //
    private static void validateCode(String code) {
        if (code == null || !CODE_PATTERN.matcher(code).matches()) {
            throw ApiException.badRequest("应用 code 必须为 2-64 位小写字母数字下划线（首字符字母）");
        }
    }

    private static void validateRequiredName(String name) {
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("应用名不能为空");
        }
        if (name.length() > 255) {
            throw ApiException.badRequest("应用名长度不能超过 255");
        }
    }
}
