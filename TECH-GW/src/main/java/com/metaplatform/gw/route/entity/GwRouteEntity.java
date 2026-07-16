package com.metaplatform.gw.route.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "gw_route")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwRouteEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "route_id", length = 128, nullable = false)
    private String routeId;

    @Column(name = "name", length = 128)
    private String name;

    @Column(name = "uri", length = 256, nullable = false)
    private String uri;

    @Column(name = "predicates", columnDefinition = "TEXT")
    private String predicates;

    @Column(name = "filters", columnDefinition = "TEXT")
    private String filters;

    @Column(name = "priority")
    private Integer priority;

    @Column(name = "enabled")
    private Boolean enabled;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
