package com.metaplatform.obs.topology.service;

import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.exception.ObsException;
import com.metaplatform.obs.topology.dto.ServiceDependenciesResponse;
import com.metaplatform.obs.topology.dto.ServiceTopologyResponse;
import com.metaplatform.obs.topology.entity.ServiceHealthEntity;
import com.metaplatform.obs.topology.repository.ServiceHealthRepository;
import com.metaplatform.obs.trace.entity.ServiceDependencyEntity;
import com.metaplatform.obs.trace.repository.ServiceDependencyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class TopologyService {

    static final Set<String> HEALTHY = Set.of("HEALTHY");
    static final Set<String> UNHEALTHY = Set.of("UNHEALTHY");
    static final Set<String> DEGRADED = Set.of("DEGRADED");

    private final ServiceDependencyRepository dependencyRepository;
    private final ServiceHealthRepository healthRepository;

    public ServiceTopologyResponse getTopology() {
        String tenantId = TenantContext.get();
        List<ServiceDependencyEntity> deps = dependencyRepository.findAll(tenantId);
        Map<String, ServiceTopologyResponse.ServiceNode> nodeMap = new HashMap<>();

        for (ServiceDependencyEntity dep : deps) {
            nodeMap.computeIfAbsent(dep.getSourceService(), k -> buildNode(k, tenantId));
            nodeMap.computeIfAbsent(dep.getTargetService(), k -> buildNode(k, tenantId));
        }

        // include known services that have health but no edges yet
        for (ServiceHealthEntity h : healthRepository.findAll(tenantId)) {
            nodeMap.computeIfAbsent(h.getServiceName(), k -> ServiceTopologyResponse.ServiceNode.builder()
                    .service(k)
                    .status(h.getStatus())
                    .responseTimeMs(h.getResponseTimeMs())
                    .errorRate(h.getErrorRate())
                    .build());
        }

        List<ServiceTopologyResponse.ServiceEdge> edges = new ArrayList<>();
        for (ServiceDependencyEntity dep : deps) {
            edges.add(ServiceTopologyResponse.ServiceEdge.builder()
                    .source(dep.getSourceService())
                    .target(dep.getTargetService())
                    .callCount(dep.getCallCount())
                    .avgDurationMs(dep.getAvgDurationMs())
                    .build());
        }

        return ServiceTopologyResponse.builder()
                .nodes(new ArrayList<>(nodeMap.values()))
                .edges(edges)
                .build();
    }

    public ServiceDependenciesResponse getServiceDependencies(String service) {
        if (service == null || service.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "service 不能为空");
        }
        String tenantId = TenantContext.get();
        List<ServiceDependencyEntity> upstream = dependencyRepository.findUpstream(tenantId, service);
        List<ServiceDependencyEntity> downstream = dependencyRepository.findDownstream(tenantId, service);
        return ServiceDependenciesResponse.builder()
                .service(service)
                .upstream(upstream.stream().map(ServiceDependencyEntity::getSourceService).distinct().toList())
                .downstream(downstream.stream().map(ServiceDependencyEntity::getTargetService).distinct().toList())
                .build();
    }

    public List<ServiceHealthEntity> getHealth() {
        return healthRepository.findAll(TenantContext.get());
    }

    public ServiceHealthEntity getServiceHealth(String service) {
        if (service == null || service.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "service 不能为空");
        }
        ServiceHealthEntity entity = healthRepository.findByServiceName(TenantContext.get(), service);
        if (entity == null) {
            throw new ObsException(ErrorCode.LOG_NOT_FOUND, "服务健康记录不存在: " + service);
        }
        return entity;
    }

    public int refreshHealth() {
        String tenantId = TenantContext.get();
        List<ServiceDependencyEntity> deps = dependencyRepository.findAll(tenantId);
        Set<String> services = new java.util.HashSet<>();
        for (ServiceDependencyEntity d : deps) {
            services.add(d.getSourceService());
            services.add(d.getTargetService());
        }
        Instant now = Instant.now();
        int updated = 0;
        for (String service : services) {
            ServiceHealthEntity existing = healthRepository.findByServiceName(tenantId, service);
            String status = existing != null ? existing.getStatus() : "UNKNOWN";
            double rt = existing != null ? existing.getResponseTimeMs() : 0.0;
            double err = existing != null ? existing.getErrorRate() : 0.0;
            // 周期刷新只更新时间戳与默认状态;真正的探测由外部探测器写入
            ServiceHealthEntity refresh = ServiceHealthEntity.builder()
                    .serviceName(service)
                    .tenantId(tenantId)
                    .status(status)
                    .lastCheckAt(now)
                    .responseTimeMs(rt)
                    .errorRate(err)
                    .build();
            healthRepository.upsert(refresh);
            updated++;
        }
        log.info("Refreshed health for {} services", updated);
        return updated;
    }

    /**
     * 上报服务健康状态,可由外部探针调用,刷新单条服务记录。
     */
    public ServiceHealthEntity reportHealth(String service, String status,
                                           double responseTimeMs, double errorRate) {
        if (service == null || service.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "service 不能为空");
        }
        String normalized = status == null ? "UNKNOWN" : status.toUpperCase();
        ServiceHealthEntity entity = ServiceHealthEntity.builder()
                .serviceName(service)
                .tenantId(TenantContext.get())
                .status(normalized)
                .lastCheckAt(Instant.now())
                .responseTimeMs(responseTimeMs)
                .errorRate(errorRate)
                .build();
        return healthRepository.upsert(entity);
    }

    private ServiceTopologyResponse.ServiceNode buildNode(String service, String tenantId) {
        ServiceHealthEntity h = healthRepository.findByServiceName(tenantId, service);
        if (h != null) {
            return ServiceTopologyResponse.ServiceNode.builder()
                    .service(service)
                    .status(h.getStatus())
                    .responseTimeMs(h.getResponseTimeMs())
                    .errorRate(h.getErrorRate())
                    .build();
        }
        return ServiceTopologyResponse.ServiceNode.builder()
                .service(service)
                .status("UNKNOWN")
                .responseTimeMs(0.0)
                .errorRate(0.0)
                .build();
    }
}