import httpx
from app.core.config import settings
import time


class DataForSEOClient:

    BASE_URL = "https://api.dataforseo.com/v3"


    def __init__(self):

        self.client = httpx.Client(
            auth=(
                settings.DATAFORSEO_LOGIN,
                settings.DATAFORSEO_PASSWORD,
            ),
            timeout=60,
        )


    def get_keyword_metrics(
        self,
        keywords: list[str],
    ):

        payload = [
            {
                "keywords": keywords,
                "location_code": 2840,
                "language_code": "en",
            }
        ]

        response = self.client.post(
            f"{self.BASE_URL}/keywords_data/google_ads/search_volume/task_post",
            json=payload,
        )


        if response.status_code != 200:
            print("DATAFORSEO ERROR:")
            print(response.text)

        response.raise_for_status()


        return response.json()


    def get_keyword_metrics_result(
        self,
        task_id: str,
        retries: int = 15,
        delay: int = 5,
    ):
        for attempt in range(retries):
            response = self.client.get(
                f"{self.BASE_URL}/keywords_data/google_ads/search_volume/task_get/{task_id}",
            )

            response.raise_for_status()
            data = response.json()

            tasks = data.get("tasks") or []

            if not tasks:
                time.sleep(delay)
                continue

            task = tasks[0]
            status_code = task.get("status_code")
            status_message = task.get("status_message")

            print(
                f"Attempt {attempt + 1}: "
                f"{status_code} - {status_message}"
            )

            # Task completed successfully
            if status_code == 20000:
                return data

            # Task is not ready yet
            if status_code in (
                40401,  # Task Not Found immediately after creation
                40601,  # Task Handed
                40602,  # Task In Queue
                40603,  # Task Being Processed
            ):
                time.sleep(delay)
                continue

            raise Exception(
                f"DataForSEO task failed: "
                f"{status_code} - {status_message}"
            )

        raise TimeoutError(
            f"DataForSEO task {task_id} did not complete "
            f"after {retries} attempts"
        )


    def search_keywords(
        self,
        keywords: list[str],
    ):
        create_response = self.get_keyword_metrics(
            keywords
        )

        if create_response.get("status_code") != 20000:
            raise Exception(
                "DataForSEO request failed: "
                f"{create_response.get('status_code')} - "
                f"{create_response.get('status_message')}"
            )

        tasks = create_response.get("tasks") or []

        if not tasks:
            raise Exception(
                "DataForSEO did not return a task"
            )

        task = tasks[0]
        task_status_code = task.get("status_code")
        task_status_message = task.get("status_message")

        if task_status_code != 20100:
            raise Exception(
                "DataForSEO task was not created: "
                f"{task_status_code} - "
                f"{task_status_message}"
            )

        task_id = task.get("id")

        if not task_id:
            raise Exception(
                "DataForSEO did not return a task ID"
            )

        result = self.get_keyword_metrics_result(
            task_id
        )

        return result["tasks"][0].get("result") or []