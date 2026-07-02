package com.metaplatform.ragmdm.mdm;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RecordMatchResult {

    private Long goldenRecordId;
    private int score;
    private String ruleName;
}
