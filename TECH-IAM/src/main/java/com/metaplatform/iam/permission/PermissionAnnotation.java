package com.metaplatform.iam.permission;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 权限声明注解（P0.2.4 @RequirePermission）。
 *
 * <p>用于 Controller / Service 方法上声明资源类型与动作。
 * PermissionAspect 会拦截并通过 PermissionResolverService 校验当前用户是否被授权。</p>
 *
 * <pre>
 * {@code
 * @PermissionAnnotation(resource = "Customer", action = "view", objectIdParam = "customerId")
 * public ApiResponse<CustomerDto> getCustomer(@PathVariable String customerId) { ... }
 * }
 * </pre>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface PermissionAnnotation {

    /** 资源类型（如 Customer / Order / Contract） */
    String resource();

    /** 动作（view / edit / create / delete / execute） */
    String action();

    /** 方法参数中作为 objectId 的名字（如 {@code customerId}）；为空则取 {@code id} */
    String objectIdParam() default "id";
}
