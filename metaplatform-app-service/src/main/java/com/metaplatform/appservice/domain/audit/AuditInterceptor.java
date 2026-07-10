package com.metaplatform.appservice.domain.audit;

import com.metaplatform.appservice.security.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Set;

/**
 * 自动审计：拦截 REST Controller 写操作（POST/PUT/DELETE/PATCH）并写入 app_audit_logs。
 *
 * <p>本类为 Sprint 0 的简化版，正式 v1.0.1 版本会加上 entity 关联、payload 加密、跨服务 trace 串联等。
 */
@Aspect
@Component
public class AuditInterceptor {

    private static final Set<String> AUDITABLE = Set.of("POST", "PUT", "DELETE", "PATCH");

    private final AuditLogRepository repository;

    public AuditInterceptor(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Around("within(@org.springframework.web.bind.annotation.RestController *)")
    public Object audit(ProceedingJoinPoint joinPoint) throws Throwable {
        Object result = joinPoint.proceed();

        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return result;
            HttpServletRequest req = attrs.getRequest();
            if (!AUDITABLE.contains(req.getMethod())) return result;

            AuditLog log = new AuditLog(
                    inferResourceType(req.getRequestURI()),
                    inferResourceId(req.getRequestURI()),
                    req.getMethod().toLowerCase(),
                    "dev-user",  // Sprint 0：默认；Sprint 1 起从 JWT 解析
                    TenantContext.get(),
                    null,
                    MDC.get("traceId")
            );
            repository.save(log);
        } catch (Exception ignored) {
            // 审计失败不该阻塞主流程
        }

        return result;
    }

    private String inferResourceType(String path) {
        if (path.startsWith("/api/apps/") && path.contains("/objects/")) return "object";
        if (path.startsWith("/api/apps/") && path.contains("/forms/")) return "form";
        if (path.startsWith("/api/apps")) return "app";
        return "other";
    }

    private Long inferResourceId(String path) {
        // 例 /api/apps/42/objects/100
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/apps/(\\d+)").matcher(path);
        if (m.find()) return Long.parseLong(m.group(1));
        return null;
    }
}
