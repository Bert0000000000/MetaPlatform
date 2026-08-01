{{/*
Expand the name of the chart.
*/}}
{{- define "kafka.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kafka.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Selector labels.
*/}}
{{- define "kafka.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kafka.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Common labels applied to every resource.
*/}}
{{- define "kafka.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "kafka.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global }}
{{- with .labels }}
{{ toYaml . }}
{{- end }}
{{- end }}
{{- end -}}

{{/*
ZooKeeper ensemble connection string.

Built from replicaCount so the ensemble scales with the chart.
Only used when kraft.enabled is false (ZooKeeper mode).
*/}}
{{- define "kafka.zookeeper.servers" -}}
{{- $fullname := include "kafka.fullname" . -}}
{{- $count := int .Values.zookeeper.replicaCount -}}
{{- range $i := until $count -}}
{{- if gt $i 0 }},{{- end -}}
{{- printf "%s-zookeeper-%d.%s-zookeeper-headless:2888:3888" $fullname $i $fullname -}}
{{- end -}}
{{- end -}}

{{/*
KRaft controller quorum voters.

Built from replicaCount so the KRaft ensemble scales correctly.
Only used when kraft.enabled is true (the default).
*/}}
{{- define "kafka.kraft.quorumVoters" -}}
{{- $fullname := include "kafka.fullname" . -}}
{{- $count := int .Values.replicaCount -}}
{{- range $i := until $count -}}
{{- if gt $i 0 }},{{- end -}}
{{- printf "%d@%s-%d.%s-headless:9093" $i $fullname $i $fullname -}}
{{- end -}}
{{- end -}}