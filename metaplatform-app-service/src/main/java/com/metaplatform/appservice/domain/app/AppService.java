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

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");
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
