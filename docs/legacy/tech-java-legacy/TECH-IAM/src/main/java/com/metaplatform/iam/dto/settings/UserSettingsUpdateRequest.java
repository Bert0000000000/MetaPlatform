package com.metaplatform.iam.dto.settings;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettingsUpdateRequest {

    @NotBlank
    private String userId;

    private String language;
    private String timezone;
    private String dateFormat;
    private String defaultPage;
    private String theme;
    private List<String> layout;
}
