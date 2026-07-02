package com.metaplatform.base.audit;

import com.metaplatform.base.tenant.TenantContext;
import com.metaplatform.base.tenant.TenantId;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private AuditEventPublisher eventPublisher;

    @Mock
    private HttpServletRequest request;

    @Mock
    private ProceedingJoinPoint joinPoint;

    @Mock
    private MethodSignature methodSignature;

    private AuditAspect auditAspect;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        auditAspect = new AuditAspect(auditLogRepository, eventPublisher, request);
        TenantContext.set(new TenantId(tenantId));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId, null));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldSaveAuditLogOnAnnotatedMethod() throws Throwable {
        // 模拟被 @Audited 标注的方法
        when(joinPoint.proceed()).thenReturn("result-id");
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getName()).thenReturn("createObjectType");
        when(methodSignature.getParameterNames()).thenReturn(new String[]{"request"});
        when(joinPoint.getArgs()).thenReturn(new Object[]{"req-data"});

        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("User-Agent")).thenReturn("JUnit");
        when(auditLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 模拟 @Audited 注解
        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE");
        when(audited.resourceType()).thenReturn("object-type");
        when(audited.resourceIdSpEL()).thenReturn("#result");

        Object result = auditAspect.audit(joinPoint, audited);

        verify(auditLogRepository, times(1)).save(any(AuditLog.class));
        verify(eventPublisher, times(1)).publish(any(AuditLog.class));
    }

    @Test
    void shouldNotFailWhenAuditLogSaveFails() throws Throwable {
        when(joinPoint.proceed()).thenReturn("result");
        when(joinPoint.getSignature()).thenReturn(methodSignature);
        when(methodSignature.getName()).thenReturn("test");
        when(methodSignature.getParameterNames()).thenReturn(new String[]{});
        when(joinPoint.getArgs()).thenReturn(new Object[]{});
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("User-Agent")).thenReturn("JUnit");

        when(auditLogRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn("CREATE");
        when(audited.resourceType()).thenReturn("test");
        when(audited.resourceIdSpEL()).thenReturn("");

        // 不应抛出异常
        Object result = auditAspect.audit(joinPoint, audited);
        verify(joinPoint).proceed();
    }
}
