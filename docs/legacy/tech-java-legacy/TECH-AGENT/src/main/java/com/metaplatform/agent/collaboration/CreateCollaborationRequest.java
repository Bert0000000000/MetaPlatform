package com.metaplatform.agent.collaboration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 创建协作任务请求（V15-04）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCollaborationRequest {

    @Size(max = 256)
    private String title;

    @NotBlank
    @Size(max = 4096)
    private String goal;

    private String description;

    private List<String> employeeIds;

    /** sequential / parallel / hybrid */
    private String splitStrategy;
}
