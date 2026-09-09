#!/usr/bin/env bash
# Sprint5 Trino 取证辅助：trino.sh "SQL"
SQL="$1"
printf '%s' "$SQL" | docker exec -i mate-trino sh -c 'curl -s -X POST -H "X-Trino-User: mate" --data-binary @- http://localhost:8080/v1/statement'
