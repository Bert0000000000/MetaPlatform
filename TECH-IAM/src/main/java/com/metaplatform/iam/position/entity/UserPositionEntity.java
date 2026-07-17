package com.metaplatform.iam.position.entity;

import com.metaplatform.iam.entity.AuditEntity;
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

import java.time.LocalDate;

@Entity
@Table(name = "iam_user_position")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class UserPositionEntity extends AuditEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    @Column(name = "position_id", nullable = false, length = 64)
    private String positionId;

    @Column(name = "department_id", nullable = false, length = 64)
    private String departmentId;

    @Column(name = "is_primary", nullable = false)
    private Boolean isPrimary;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}