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

{{/*
Renders OTel environment variables consumed by every app chart.
GOVERN-09 closes §13-硬规则#9 gap: prior to this commit,
service-templates exposed `otel.sidecar.enabled=true` in values but
no helper rendered the env block. Per-app charts now include
`{{- include "service-templates.otelEnv" . }}` to inherit the same
endpoint / sampler / resource attribute defaults.
Usage: include "service-templates.otelEnv" .
*/}}
{{- define "service-templates.otelEnv" -}}
- name: OTEL_SERVICE_NAME
  value: {{ .Chart.Name }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.defaults.otel.exporterEndpoint | default "http://otel-collector:4317" }}
- name: OTEL_RESOURCE_ATTRIBUTES
  value: {{ .Values.defaults.otel.resourceAttributes | default "service.name=$(OTEL_SERVICE_NAME)" }}
- name: OTEL_TRACES_SAMPLER
  value: {{ .Values.defaults.otel.sampler | default "parentbased_traceidratio" }}
- name: OTEL_TRACES_SAMPLER_ARG
  value: {{ .Values.defaults.otel.samplerArg | default "0.1" | quote }}
- name: OTEL_METRICS_EXPORTER
  value: {{ .Values.defaults.otel.metricsExporter | default "otlp" }}
- name: OTEL_LOGS_EXPORTER
  value: {{ .Values.defaults.otel.logsExporter | default "otlp" }}
{{- end -}}