from typing_extensions import TypedDict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.providers.llm.base import LLMProvider
from app.services.semantic_search import semantic_search
from app.models.website_profile import WebsiteProfile
from langgraph.graph import (
    StateGraph,
    START,
    END,
)


class WebsiteProfileState(TypedDict):
    website_id: int
    website_context: str
    profile: dict

@dataclass
class WebsiteProfileContext:
    db: Session
    llm: LLMProvider


def retrieve_website_context(
    state,
    runtime,
):

    results = semantic_search(
        db=runtime.context.db,
        website_id=state["website_id"],
        query=(
            "Describe this business, "
            "services, customers, "
            "industry and brand."
        ),
        limit=8,
    )

    context = "\n\n".join(
        [
            item["content"]
            for item in results
        ]
    )

    return {
        "website_context": context
    }


def analyze_business(
    state,
    runtime,
):

    system_prompt = """

You are an SEO business analyst.

Analyze the website information and create a detailed SEO intelligence profile.

Return ONLY valid JSON.

Do not use markdown.
Do not add explanations.
Do not wrap in ```json.

Extract these fields:

{
  "business_name": "",
  "industry": "",
  
  "business_summary": "",

  "services": [],

  "service_categories": [],

  "target_audience": [],

  "customer_pain_points": [],

  "unique_selling_points": [],

  "locations": [],

  "business_goals": [],

  "brand_tone": "",

  "content_themes": [],

  "seo_opportunities": []
}


Rules:

- Only use information found in the website context.
- Do not invent services or locations.
- If information is missing use null or empty arrays.
- Think like an SEO strategist.

"""


    answer = runtime.context.llm.generate(
        system_prompt,
        f"""
Website information:

{state["website_context"]}
"""
    )

    import json

    profile = json.loads(
        answer
    )


    return {
        "profile": profile
    }


def save_profile(
    state,
    runtime,
):

    existing = runtime.context.db.query(
        WebsiteProfile
    ).filter(
        WebsiteProfile.website_id
        == state["website_id"]
    ).first()

    if existing:

        existing.profile_data = (
            state["profile"]
        )

    else:

        profile = WebsiteProfile(
            website_id=
                state["website_id"],

            profile_data=
                state["profile"]
        )

        runtime.context.db.add(
            profile
        )

    runtime.context.db.commit()

    return {}


builder = StateGraph(
    WebsiteProfileState,
    context_schema=WebsiteProfileContext,
)

builder.add_node(
    "retrieve",
    retrieve_website_context
)

builder.add_node(
    "analyze",
    analyze_business
)

builder.add_node(
    "save",
    save_profile
)

builder.add_edge(
    START,
    "retrieve"
)

builder.add_edge(
    "retrieve",
    "analyze"
)

builder.add_edge(
    "analyze",
    "save"
)

builder.add_edge(
    "save",
    END
)

website_profile_graph = builder.compile()