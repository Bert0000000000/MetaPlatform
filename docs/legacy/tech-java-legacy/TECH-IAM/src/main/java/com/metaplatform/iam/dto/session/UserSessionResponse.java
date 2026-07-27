package com.metaplatform.iam.dto.session;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSessionResponse {

    private String id;
    private String device;
    private String ip;
    private String location;
    private Instant lastActiveAt;
    private boolean current;
}
