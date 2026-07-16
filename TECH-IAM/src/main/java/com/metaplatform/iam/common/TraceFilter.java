package com.metaplatform.iam.common;

import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@WebFilter("/*")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            if (request instanceof HttpServletRequest httpRequest) {
                String traceId = httpRequest.getHeader(TraceContext.TRACE_ID_HEADER);
                TraceContext.set(traceId);
            } else {
                TraceContext.getOrCreate();
            }
            chain.doFilter(request, response);
        } finally {
            TraceContext.clear();
        }
    }
}
