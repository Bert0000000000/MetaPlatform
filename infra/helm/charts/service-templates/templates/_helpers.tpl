{{/*
Renders a securityContext block suitable for a pod spec.
Usage: include "service-templates.podSecurityContext" .
*/}}
{{- define "service-templates.podSecurityContext" -}}
runAsNonRoot: {{ .Values.defaults.securityContext.runAsNonRoot }}
runAsUser: {{ .Values.defaults.securityContext.runAsUser }}
fsGroup: {{ .Values.defaults.securityContext.runAsUser }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/*
Renders a container securityContext.
Usage: include "service-templates.containerSecurityContext" .
*/}}
{{- define "service-templates.containerSecurityContext" -}}
runAsNonRoot: {{ .Values.defaults.securityContext.runAsNonRoot }}
readOnlyRootFilesystem: {{ .Values.defaults.securityContext.readOnlyRootFilesystem }}
allowPrivilegeEscalation: {{ .Values.defaults.securityContext.allowPrivilegeEscalation }}
capabilities:
  drop:
    {{- range .Values.defaults.securityContext.capabilities.drop }}
    - {{ . }}
    {{- end }}
{{- end -}}