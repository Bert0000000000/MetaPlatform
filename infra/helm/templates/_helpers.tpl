{{/*
Expand the name of the chart.
*/}}
{{- define "metaplatform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 50 chars because some K8s name fields are limited to 63
(per RFC 1123) and we want to leave room for the component suffix.
*/}}
{{- define "metaplatform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 50 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Component fullname (used by sub-charts).
Usage: include "metaplatform.componentName" (dict "ctx" . "component" "otel-collector")
*/}}
{{- define "metaplatform.componentName" -}}
{{- $ctx := .ctx -}}
{{- $component := .component -}}
{{- printf "%s-%s" $ctx.Release.Name $component | trunc 50 | trimSuffix "-" -}}
{{- end -}}

{{/*
Chart label.
*/}}
{{- define "metaplatform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels (applied to every resource).
Usage: include "metaplatform.labels" .
*/}}
{{- define "metaplatform.labels" -}}
helm.sh/chart: {{ include "metaplatform.chart" . }}
{{ include "metaplatform.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.labels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/*
Selector labels (used in matchLabels).
Usage: include "metaplatform.selectorLabels" .
*/}}
{{- define "metaplatform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "metaplatform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Image reference.
Usage: include "metaplatform.image" (dict "image" .Values.path.to.image "global" .Values.global)
*/}}
{{- define "metaplatform.image" -}}
{{- $registry := .global.imageRegistry | default "" -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry .image.repository .image.tag -}}
{{- else -}}
{{- printf "%s:%s" .image.repository .image.tag -}}
{{- end -}}
{{- end -}}

{{/*
Secret reference. Always uses existingSecretName; never inline.
Usage: include "metaplatform.secretKeyRef" (dict "secretName" "keycloak-admin" "secretKey" "password")
*/}}
{{- define "metaplatform.secretKeyRef" -}}
secretKeyRef:
  name: {{ .secretName }}
  key: {{ .secretKey }}
{{- end -}}

{{/*
Tenant ID attribute name (used in OTel processors and NetworkPolicy selectors).
*/}}
{{- define "metaplatform.tenantIdKey" -}}
{{- .Values.global.tenantIdKey | default "tenant.id" -}}
{{- end -}}