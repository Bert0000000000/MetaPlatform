package com.metaplatform.ragmdm.domain.enums;

public enum MergeStrategy {
    MASTER_WINS,      // 黄金记录优先
    LATEST_WINS,      // 最新数据覆盖
    MOST_COMPLETE     // 最完整的值
}
