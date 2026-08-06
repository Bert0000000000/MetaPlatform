# D3: Airflow DAG template that triggers GE expectation checks
# In v3.1, every DDL migration runs the corresponding GE suite
# before applying. This DAG is the canonical template.
from datetime import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "metaplatform-data-quality",
    "depends_on_past": False,
    "start_date": datetime(2026, 1, 1),
    "retries": 1,
}

# {{ domain }} is templated per data product.
with DAG(
    dag_id="ge_expectations_{{ domain }}",
    default_args=default_args,
    schedule_interval="@daily",
    catchup=False,
) as dag:
    run_ge = BashOperator(
        task_id="run_great_expectations",
        bash_command=(
            "great_expectations --config /etc/ge/{{ domain }}/"
            "great_expectations.yml checkpoint {{ domain }}"
        ),
    )
