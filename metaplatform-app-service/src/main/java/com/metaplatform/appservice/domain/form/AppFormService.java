package com.metaplatform.appservice.domain.form;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppRepository;
import com.metaplatform.appservice.domain.object.AppObjectRepository;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

@Service
public class AppFormService {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");

    private final AppRepository appRepository;
    private final AppObjectRepository objectRepository;
    private final AppFormRepository repository;

    public AppFormService(AppRepository appRepository,
                          AppObjectRepository objectRepository,
                          AppFormRepository repository) {
        this.appRepository = appRepository;
        this.objectRepository = objectRepository;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<AppFormEntity> list(Long appId) {
        ensureAppOwnsTenant(appId);
        return repository.findByAppId(appId);
    }

    @Transactional(readOnly = true)
    public AppFormEntity get(Long appId, Long fid) {
        ensureAppOwnsTenant(appId);
        return repository.findByIdAndAppId(fid, appId)
                .orElseThrow(() -> ApiException.notFound("表单 " + fid + " 不存在"));
    }

    @Transactional
    public AppFormEntity create(Long appId, AppFormCreateRequest req) {
        ensureAppOwnsTenant(appId);
        validateCode(req.code());
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("name 必填");
        }
        if (req.schema() == null) {
            throw ApiException.badRequest("schema 必填");
        }
        // object 必须属于该 app + tenant
        var obj = objectRepository.findByIdAndAppId(req.objectId(), appId)
                .orElseThrow(() -> ApiException.notFound("对象 " + req.objectId() + " 不存在或与 app 不匹配"));

        AppFormEntity form = new AppFormEntity();
        form.setAppId(appId);
        form.setObjectId(obj.getId());
        form.setCode(req.code());
        form.setName(req.name());
        form.setSchemaJson(req.schema());
        form.setStatus("draft");
        form.setCreatedBy("dev-user");
        try {
            return repository.save(form);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("表单 code 已存在: " + req.code());
        }
    }

    @Transactional
    public AppFormEntity update(Long appId, Long fid, AppFormUpdateRequest req) {
        var form = get(appId, fid);
        if ("published".equals(form.getStatus())) {
            throw ApiException.badRequest("已发布的表单不可编辑；请新建版本");
        }
        if (req.name() != null) form.setName(req.name());
        if (req.schema() != null) form.setSchemaJson(req.schema());
        form.setVersion(form.getVersion() + 1);
        return repository.save(form);
    }

    @Transactional
    public AppFormEntity publish(Long appId, Long fid) {
        var form = get(appId, fid);
        form.setStatus("published");
        form.setVersion(form.getVersion() + 1);
        return repository.save(form);
    }

    private void ensureAppOwnsTenant(Long appId) {
        appRepository.findByIdAndTenantId(appId, TenantContext.required())
                .orElseThrow(() -> ApiException.notFound("应用 " + appId + " 不存在"));
    }

    private static void validateCode(String code) {
        if (code == null || !CODE_PATTERN.matcher(code).matches()) {
            throw ApiException.badRequest("code 非法");
        }
    }

    public record AppFormCreateRequest(Long objectId, String code, String name, String schema) {}
    public record AppFormUpdateRequest(String name, String schema) {}
}
