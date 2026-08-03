{{/*
Expand the name of the chart.
*/}}
{{- define "starrocks.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
FE fullname helper — forces "starrocks-fe" so JDBC clients can
hardcode the service DNS.
*/}}
{{- define "starrocks.feFullname" -}}
{{- if .Values.fe.fullnameOverride -}}
{{- .Values.fe.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-fe" (include "starrocks.name" .) -}}
{{- end -}}
{{- end -}}

{{/*
BE fullname helper — forces "starrocks-be" for the same reason.
*/}}
{{- define "starrocks.beFullname" -}}
{{- if .Values.be.fullnameOverride -}}
{{- .Values.be.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-be" (include "starrocks.name" .) -}}
{{- end -}}
{{- end -}}

{{/*
Common labels.
*/}}
{{- define "starrocks.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "starrocks.name" . | quote }}: {{ .Chart.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global }}
{{- with .labels }}
{{ toYaml . }}
{{- end }}
{{- end }}
{{- end -}}