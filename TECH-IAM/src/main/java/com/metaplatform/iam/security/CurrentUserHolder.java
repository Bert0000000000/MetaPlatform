package com.metaplatform.iam.security;

import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.common.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;

/**
 * 从 SecurityContext 中解析当前登录用户信息。
 * - userId 写入到 Authentication.principal 的 credentials 字段中（参见 JwtAuthenticationFilter）
 * - username 从 principal.username 解析
 * - roles / tenantId 从 JWT claims 解析
 */
public final class CurrentUserHolder {

    private CurrentUserHolder() {
    }

    public static String requireUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null
                || "anonymousUser".equals(auth.getName())) {
            throw new IamException(ErrorCode.UNAUTHORIZED, "未登录或登录状态已失效");
        }
        Object credentials = auth.getCredentials();
        if (credentials == null) {
            throw new IamException(ErrorCode.UNAUTHORIZED, "无法解析当前用户 ID");
        }
        return credentials.toString();
    }

    public static String getUsernameOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        return auth.getName();
    }

    @SuppressWarnings("unchecked")
    public static List<String> getRolesOrEmpty() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return Collections.emptyList();
        }
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .filter(s -> s != null && !s.startsWith("ROLE_"))
                .toList();
    }
}