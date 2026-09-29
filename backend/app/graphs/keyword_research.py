from typing_extensions import TypedDict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.providers.llm.base import LLMProvider
from sqlalchemy import select
from app.models.topic import Topic
from langgraph.graph import (
    StateGraph,
    START,
    END,
)
from app.models.keyword_metric import KeywordMetric
from app.services.dataforseo import DataForSEOClient



class KeywordResearchState(TypedDict):
    website_id: int
    topics: list[dict]
    keywords: list[dict]
    keyword_metrics: list[dict]

@dataclass
class KeywordResearchContext:
    db: Session
    llm: LLMProvider



def load_topics(
    state,
    runtime,
):

    topics = runtime.context.db.scalars(
        select(Topic).where(
            Topic.website_id ==
            state["website_id"]
        )
    ).all()


    return {
        "topics": [
            {
                "id": topic.id,
                "title": topic.title,
                "keyword_ideas": topic.keyword_ideas,
            }
            for topic in topics
        ]
    }

def extract_keywords(
    state,
    runtime,
):

    keywords = []

    for topic in state["topics"]:

        for keyword in topic["keyword_ideas"]:

            keywords.append(
                {
                    "topic_id": topic["id"],
                    "keyword": keyword,
                }
            )

    return {
        "keywords": keywords
    }

def save_keywords(
    state,
    runtime,
):

    db = runtime.context.db

    keyword_topic_map = {
        item["keyword"]: item["topic_id"]
        for item in state["keywords"]
    }

    for metric in state["keyword_metrics"]:

        topic_id = keyword_topic_map.get(
            metric["keyword"]
        )

        metric_db = KeywordMetric(

            topic_id=topic_id,

            keyword=metric["keyword"],

            search_volume=metric.get(
                "search_volume"
            ),

            cpc=metric.get(
                "cpc"
            ),

            competition=metric.get(
                "competition"
            ),

            serp_data=metric,
        )

        db.add(metric_db)

    db.commit()


    return {}


def fetch_keyword_metrics(
    state,
    runtime,
):

    client = DataForSEOClient()

    keywords = [
        item["keyword"]
        for item in state["keywords"]
    ]

    metrics = client.search_keywords(
        keywords
    )


    return {
        "keyword_metrics": metrics
    }



builder = StateGraph(
    KeywordResearchState,
    context_schema=KeywordResearchContext,
)

builder.add_node(
    "load_topics",
    load_topics,
)

builder.add_node(
    "extract_keywords",
    extract_keywords,
)

builder.add_node(
    "save_keywords",
    save_keywords,
)

builder.add_node(
    "fetch_metrics",
    fetch_keyword_metrics,
)

builder.add_edge(
    START,
    "load_topics",
)

builder.add_edge(
    "load_topics",
    "extract_keywords",
)

builder.add_edge(
    "extract_keywords",
    "fetch_metrics",
)

builder.add_edge(
    "fetch_metrics",
    "save_keywords",
)

builder.add_edge(
    "save_keywords",
    END,
)

keyword_research_graph = builder.compile()