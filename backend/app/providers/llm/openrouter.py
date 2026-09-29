import httpx
from app.core.config import settings
from app.providers.llm.base import LLMProvider


class OpenRouterProvider(LLMProvider):

    API_URL = (
        "https://openrouter.ai/api/v1/chat/completions"
    )

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:

        headers = {
            "Authorization": (
                f"Bearer {settings.openrouter_api_key}"
            ),
            "Content-Type": "application/json",
        }

        payload = {
            "model": settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            "temperature": 0.2,
            "max_completion_tokens": 10000,
            "response_format": {
                "type": "json_object"
            },
            "include_reasoning": False,
        }

        try:
            response = httpx.post(
                self.API_URL,
                headers=headers,
                json=payload,
                timeout=60.0,
            )

            response.raise_for_status()

        except httpx.HTTPError as exc:
            raise RuntimeError(
                f"OpenRouter request failed: {exc}"
            ) from exc

        data = response.json()

        try:
            content = data[
                "choices"
            ][0][
                "message"
            ][
                "content"
            ]

        except (
            KeyError,
            IndexError,
            TypeError,
        ) as exc:
            raise RuntimeError(
                "OpenRouter returned an unexpected response."
            ) from exc

        if not content:
            raise RuntimeError(
                "OpenRouter returned an empty response."
            )

        return content.strip()