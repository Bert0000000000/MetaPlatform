package com.metaplatform.ont.dto;

import lombok.Data;

import java.util.List;

@Data
public class SuggestRequest {

    private List<String> concepts;
    private List<String> relations;
}
