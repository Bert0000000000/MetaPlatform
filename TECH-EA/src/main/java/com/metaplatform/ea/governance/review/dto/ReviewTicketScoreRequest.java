package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ReviewTicketScoreRequest {

    @NotBlank(message = "评审人不能为空")
    private String reviewer;

    private List<ReviewScoreItemRequest> scores;
    private String comment;
    private String decision;
}
