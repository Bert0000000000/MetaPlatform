package com.metaplatform.iam.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private String id;
    private String tenantId;
    private String username;
    private String email;
    private String realName;
    private String phone;
    private String avatarUrl;
    private String status;
    private Boolean requirePasswordReset;
    private Instant lastLoginAt;
    private Instant createdAt;
    private Instant updatedAt;
}
