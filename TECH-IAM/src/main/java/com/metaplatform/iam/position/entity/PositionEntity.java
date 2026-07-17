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

@Entity
@Table(name = "iam_position")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class PositionEntity extends AuditEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "code", nullable = false, length = 128)
    private String code;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "level", nullable = false)
    private Integer level;

    @Column(name = "parent_id", length = 64)
    private String parentId;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;
}