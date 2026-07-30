from tenacity import Retrying, stop_after_attempt, wait_exponential

DEFAULT = Retrying(stop=stop_after_attempt(3), wait=wait_exponential(min=0.5, max=10))


def retry() -> Retrying:
    return DEFAULT
