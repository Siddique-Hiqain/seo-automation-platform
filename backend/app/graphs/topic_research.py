import json
from typing_extensions import TypedDict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.providers.llm.base import LLMProvider
from sqlalchemy import select
from app.models.website_profile import WebsiteProfile
from app.models.topic import Topic
from langgraph.graph import (
    StateGraph,
    START,
    END,
)



class TopicResearchState(TypedDict):
    website_id: int
    profile: dict
    topics: list[dict]

@dataclass
class TopicResearchContext:
    db: Session
    llm: LLMProvider



def load_profile(
    state,
    runtime,
):

    profile = runtime.context.db.scalar(
        select(
            WebsiteProfile
        ).where(
            WebsiteProfile.website_id
            == state["website_id"]
        )
    )

    if profile is None:
        raise ValueError(
            "Website profile not found"
        )

    return {
        "profile": profile.profile_data
    }


def generate_topics(
    state,
    runtime,
):

    prompt = f"""

You are an expert SEO strategist.

Analyze this website profile:

{state["profile"]}


Your task:
Generate exactly 20 SEO content opportunities for this business.


IMPORTANT OUTPUT RULES:

- Return ONLY valid JSON.
- Do NOT use markdown.
- Do NOT use ```json.
- Do NOT add explanations before or after the JSON.
- The response must start with {{ and end with }}.


The JSON format must be exactly:

{{
  "topics": [
    {{
      "title": "SEO topic title",
      "keyword_ideas": [
        "keyword 1",
        "keyword 2",
        "keyword 3"
      ],
      "search_intent": "informational",
      "business_value": "High",
      "reasoning": "Explain why this topic is valuable for this business"
    }}
  ]
}}


Requirements:

- Generate exactly 20 topics.
- Topics must be directly related to the company's services.
- Focus on topics that can attract potential customers.
- Prioritize commercial opportunities where relevant.
- Include informational topics that build authority.
- Avoid generic topics that do not match the business.
- Do not invent services that are not present in the website profile.
- Use the website profile as the only source of business information.


Search Intent Rules:

Use one of:

- informational
  (education, guides, how-to content)

- commercial investigation
  (users comparing solutions or looking for providers)

- transactional
  (users ready to purchase a service)


Business Value Rules:

Use one of:

- High
  (strongly connected to a service and likely to generate leads)

- Medium
  (supports authority and attracts relevant traffic)

- Low
  (general awareness content)


Quality Rules:

Each topic should answer:

1. Does this help the target audience?
2. Does this connect to a business service?
3. Could this attract organic search traffic?
4. Could this eventually generate a customer?


Example:

{{
  "topics": [
    {{
      "title": "Shopify SEO Checklist for Ecommerce Stores",
      "keyword_ideas": [
        "shopify seo checklist",
        "shopify seo tips",
        "optimize shopify store"
      ],
      "search_intent": "informational",
      "business_value": "High",
      "reasoning": "Targets ecommerce businesses that may need Shopify SEO services."
    }}
  ]
}}

"""

    response = runtime.context.llm.generate(
        "You are an expert SEO strategist.",
        prompt,
    )

    data = json.loads(response)

    if isinstance(data, dict):
        topics = data.get(
            "topics",
            []
        )

    else:
        topics = data

    if not isinstance(topics, list):
        raise ValueError(
            "Topics response must be a list"
        )


    return {
        "topics": topics
    }


def save_topics(
    state,
    runtime,
):

    db = runtime.context.db

    for item in state["topics"]:

        topic = Topic(

            website_id=
            state["website_id"],

            title=
            item["title"],

            keyword_ideas=
            item["keyword_ideas"],

            search_intent=
            item["search_intent"],

            business_value=
            item["business_value"],

            reasoning=
            item["reasoning"],
        )

        db.add(topic)

    db.commit()

    return {}



builder = StateGraph(
    TopicResearchState,
    context_schema=TopicResearchContext,
)

builder.add_node(
    "load_profile",
    load_profile,
)

builder.add_node(
    "generate_topics",
    generate_topics,
)

builder.add_node(
    "save_topics",
    save_topics,
)

builder.add_edge(
    START,
    "load_profile",
)

builder.add_edge(
    "load_profile",
    "generate_topics",
)

builder.add_edge(
    "generate_topics",
    "save_topics",
)

builder.add_edge(
    "save_topics",
    END,
)

topic_research_graph = builder.compile()