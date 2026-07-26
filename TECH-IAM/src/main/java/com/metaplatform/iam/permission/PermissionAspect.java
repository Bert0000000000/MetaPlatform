package com.metaplatform.iam.permission;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Collections;

/**
 * 权限 AOP 拦截器（P0.2.4）。
 *
 * <p>配合 {@link PermissionAnnotation} 使用。流程：</p>
 * <ol>
 *   <li>解析注解 resource/action/objectIdParam</li>
 *   <li>从 SpEL 上下文拿到 objectId（路径变量 / 请求体字段）</li>
 *   <li>调用 {@link PermissionResolverService#resolveAllowedActions} 校验</li>
 *   <li>不通过则抛 {@link IamException}</li>
 * </ol>
 *
 * <p>P0.2 提供骨架；P5.1 接 ActionPolicy.yaml 后按角色 + 风险等级双因素判断。</p>
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class PermissionAspect {

    private final PermissionResolverService resolver;
    private final ExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNameDiscoverer = new DefaultParameterNameDiscoverer();

    @Around("@annotation(perm)")
    public Object check(ProceedingJoinPoint pjp, PermissionAnnotation perm) throws Throwable {
        String objectId = resolveObjectId(pjp, perm);
        String userId = CurrentUserHolder.requireUserId();
        String tenantId = CurrentUserHolder.tenantIdOrDefault();

        boolean allowed = resolver.resolveAllowedActions(tenantId, userId,
                Collections.singletonList(perm.action())).contains(perm.action());
        if (!allowed) {
            log.warn("[PermissionAspect] DENY user={} action={}.{} objectId={}",
                    userId, perm.resource(), perm.action(), objectId);
            throw new IamException(ErrorCode.FORBIDDEN,
                    "用户 " + userId + " 没有执行 " + perm.resource() + "." + perm.action() + " 的权限");
        }
        log.debug("[PermissionAspect] ALLOW user={} action={}.{} objectId={}",
                userId, perm.resource(), perm.action(), objectId);
        return pjp.proceed();
    }

    private String resolveObjectId(ProceedingJoinPoint pjp, PermissionAnnotation perm) {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Method method = sig.getMethod();
        String[] names = parameterNameDiscoverer.getParameterNames(method);
        if (names == null || names.length == 0) {
            return null;
        }
        EvaluationContext ctx = new StandardEvaluationContext();
        Object[] args = pjp.getArgs();
        for (int i = 0; i < names.length; i++) {
            ctx.setVariable(names[i], args[i]);
        }
        String paramName = perm.objectIdParam() == null || perm.objectIdParam().isEmpty()
                ? "id" : perm.objectIdParam();
        try {
            Object value = parser.parseExpression("#" + paramName).getValue(ctx);
            return value == null ? null : value.toString();
        } catch (Exception ex) {
            log.debug("[PermissionAspect] resolveObjectId failed param={}", paramName, ex);
            return null;
        }
    }
}
