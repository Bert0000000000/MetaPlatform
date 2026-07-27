package com.metaplatform.agent.runtime;

import com.metaplatform.agent.middleware.MiddlewareContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RuntimeRouter {

    public RouteDecision route(MiddlewareContext context) {
        String msg = context.getUserMessage() == null ? "" : context.getUserMessage();
        if (msg.length() > 200) return RouteDecision.DEEP;
        if (containsAny(msg, "分析", "对比", "总结", "查找", "诊断", "预测", "建议")) return RouteDecision.DEEP;
        if (msg.contains("和") && msg.contains("之间")) return RouteDecision.DEEP;
        return RouteDecision.FAST;
    }

    private boolean containsAny(String s, String... keys) {
        for (String k : keys) if (s.contains(k)) return true;
        return false;
    }

    public enum RouteDecision {
        FAST, DEEP;
        public boolean isDeep() { return this == DEEP; }
    }
}
