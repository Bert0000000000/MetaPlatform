package com.metaplatform.iam.dto.apikey;

import lombok.Data;

/**
 * 吊销 API Key 请求。reason 可选。
 */
@Data
public class RevokeRequest {

    private String reason;
}
