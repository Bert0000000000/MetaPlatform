package com.metaplatform.iam.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "iam_department")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class DepartmentEntity extends AuditEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "dept_code", nullable = false, length = 128)
    private String deptCode;

    @Column(name = "dept_name", nullable = false, length = 256)
    private String deptName;

    @Column(name = "parent_id", length = 64)
    private String parentId;

    @Column(name = "parent_path", length = 1024)
    private String parentPath;

    @Column(name = "full_path", nullable = false, length = 1024)
    private String fullPath;

    @Column(name = "level", nullable = false)
    private Integer level;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "leader_id", length = 64)
    private String leaderId;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}