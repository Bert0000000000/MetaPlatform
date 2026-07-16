package com.metaplatform.ont.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RelationTypeCount {

    private String type;

    private long count;
}
