package com.metaplatform.base.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记在方法上，AOP 切面会自动记录审计日志。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    String action();
    String resourceType();
    String resourceIdSpEL() default ""; // SpEL 表达式，从返回值或参数中提取 resourceId
}
