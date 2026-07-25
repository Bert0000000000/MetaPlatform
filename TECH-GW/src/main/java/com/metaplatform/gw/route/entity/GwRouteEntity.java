package com.metaplatform.gw.route.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "gw_route")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GwRouteEntity {

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "route_id", nullable = false, length = 128)
    private String routeId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "name", length = 128)
    private String name;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "uri", nullable = false, length = 256)
    private String uri;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "predicates", columnDefinition = "TEXT")
    private String predicates;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "filters", columnDefinition = "TEXT")
    private String filters;

    @Column(name = "priority")
    private Integer priority;

    @Column(name = "enabled")
    private Boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
