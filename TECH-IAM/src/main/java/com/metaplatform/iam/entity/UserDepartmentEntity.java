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
@Table(name = "iam_user_department")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class UserDepartmentEntity extends AuditEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "department_id", nullable = false, length = 64)
    private String departmentId;

    @Column(name = "position_id", length = 64)
    private String positionId;

    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}