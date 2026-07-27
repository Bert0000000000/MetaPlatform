package com.metaplatform.ont.context;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Local permission snapshot DTO (P1.2.3 闂呮梻顬?.
 *
 * <p>娑撹桨绨￠柆鍨帳 TECH-ONT 娑?TECH-IAM 娑斿妫块惃鍕儕閻滎垯绶风挧鏍电礉閺堫剛琚崷?TECH-ONT 閺堫剙婀寸€规矮绠熼敍? * 鐎涙顔屾稉?TECH-IAM 娑擃厾娈?PermissionSnapshotDto 鐎瑰苯鍙忕€靛綊缍堥妴?/p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionSnapshotDto {
    private String snapshotId;
    private String dataScope;
    private String rowFilter;
    private List<String> deniedFields;
    private List<String> allowedActions;
    private List<String> approvalRequiredActions;
    private List<String> concepts;
    private List<String> metrics;
    private List<String> regions; private List<String> allowedRelations;
}