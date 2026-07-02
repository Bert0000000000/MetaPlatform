package com.metaplatform.base.audit;

import com.metaplatform.base.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
@Order(1) // 确保在事务之后执行
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);
    private static final ExpressionParser parser = new SpelExpressionParser();

    private final AuditLogRepository auditLogRepository;
    private final AuditEventPublisher eventPublisher;
    private final HttpServletRequest request;

    public AuditAspect(AuditLogRepository auditLogRepository,
                       AuditEventPublisher eventPublisher,
                       HttpServletRequest request) {
        this.auditLogRepository = auditLogRepository;
        this.eventPublisher = eventPublisher;
        this.request = request;
    }

    @Around("@annotation(audited)")
    public Object audit(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        Object result = joinPoint.proceed();

        try {
            UUID tenantId = TenantContext.get().value();
            UUID userId = getCurrentUserId();
            String resourceId = resolveResourceId(audited.resourceIdSpEL(), joinPoint, result);

            String details = buildDetails(joinPoint, result);

            AuditLog auditLog = new AuditLog(
                    tenantId,
                    userId,
                    audited.action(),
                    audited.resourceType(),
                    resourceId,
                    details,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent")
            );

            // 1. 写 PG（append-only）
            AuditLog saved = auditLogRepository.save(auditLog);

            // 2. 发 Kafka 事件（异步）
            eventPublisher.publish(saved);

        } catch (Exception e) {
            // 审计日志失败不应影响业务
            log.error("Failed to create audit log: {}", e.getMessage(), e);
        }

        return result;
    }

    private UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UUID userId) {
            return userId;
        }
        return UUID.fromString("00000000-0000-0000-0000-000000000000"); // system
    }

    private String resolveResourceId(String spel, ProceedingJoinPoint joinPoint, Object result) {
        if (spel == null || spel.isBlank()) {
            return "unknown";
        }
        try {
            EvaluationContext context = new StandardEvaluationContext();
            // 将方法参数绑定到 SpEL 上下文
            MethodSignature sig = (MethodSignature) joinPoint.getSignature();
            String[] paramNames = sig.getParameterNames();
            Object[] args = joinPoint.getArgs();
            for (int i = 0; i < paramNames.length; i++) {
                ((StandardEvaluationContext) context).setVariable(paramNames[i], args[i]);
            }
            // 将返回值设为 root
            return parser.parseExpression(spel).getValue(context, result, String.class);
        } catch (Exception e) {
            log.warn("Failed to resolve resourceId from SpEL '{}': {}", spel, e.getMessage());
            return "unknown";
        }
    }

    private String buildDetails(ProceedingJoinPoint joinPoint, Object result) {
        // v0.1 简化：只记录方法名和参数类型
        return String.format("{\"method\":\"%s\",\"resultType\":\"%s\"}",
                joinPoint.getSignature().getName(),
                result != null ? result.getClass().getSimpleName() : "void");
    }
}
