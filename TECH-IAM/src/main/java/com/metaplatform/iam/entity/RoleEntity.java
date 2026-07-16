package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "iam_role")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class RoleEntity extends AuditEntity {

    public enum RoleType {
        SYSTEM,
        CUSTOM
    }

    public enum DataScope {
        ALL,
        DEPT,
        DEPT_AND_SUB,
        SELF,
        CUSTOM
    }

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "role_code", nullable = false, length = 128)
    private String roleCode;

    @Column(name = "role_name", nullable = false, length = 256)
    private String roleName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_type", nullable = false, length = 32)
    private RoleType roleType;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_scope", nullable = false, length = 32)
    private DataScope dataScope;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}