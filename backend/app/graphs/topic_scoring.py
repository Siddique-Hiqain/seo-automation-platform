from typing_extensions import TypedDict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from app.providers.llm.base import LLMProvider
from app.models.topic import Topic
from app.models.keyword_metric import KeywordMetric
from sqlalchemy import select
from langgraph.graph import (
    StateGraph,
    START,
    END,
)



class TopicScoringState(TypedDict):
    website_id: int
    topics: list[dict]
    metrics: list[dict]
    scores: list[dict]

@dataclass
class TopicScoringContext:
    db: Session


def load_topics(
    state,
    runtime
):

    db = runtime.context.db


    topics = db.query(Topic).filter(
        Topic.website_id ==
        state["website_id"]
    ).all()


    return {
        "topics": [
            {
                "id":t.id,
                "business_value":t.business_value,
                "title":t.title
            }
            for t in topics
        ]
    }

def load_metrics(
    state,
    runtime,
):

    db = runtime.context.db

    metrics = db.scalars(
        select(KeywordMetric)
        .join(Topic)
        .where(
            Topic.website_id ==
            state["website_id"]
        )
    ).all()

    return {
        "metrics": [
            {
                "topic_id": metric.topic_id,

                "keyword": metric.keyword,

                "search_volume":
                    metric.search_volume or 0,

                "cpc":
                    metric.cpc or 0,

                "competition":
                    metric.competition,
            }

            for metric in metrics
        ]
    }

def calculate_scores(
    state,
    runtime,
):

    scores = []

    for topic in state["topics"]:
        topic_metrics = [
            metric
            for metric in state["metrics"]
            if metric["topic_id"] == topic["id"]
        ]

        if not topic_metrics:
            continue


        best_metric = max(
            topic_metrics,
            key=lambda x: x["search_volume"]
        )

        volume_score = calculate_volume_score(
            best_metric["search_volume"]
        )

        cpc_score = calculate_cpc_score(
            best_metric["cpc"]
        )

        competition_score = calculate_competition_score(
            best_metric["competition"]
        )

        business_score = calculate_business_score(
            topic["business_value"]
        )

        final_score = (
            volume_score * 0.4
            +
            cpc_score * 0.2
            +
            competition_score * 0.2
            +
            business_score * 0.2
        )

        scores.append(
            {
                "topic_id": topic["id"],

                "score": round(
                    final_score,
                    2
                )
            }
        )


    return {
        "scores": scores
    }

#Calculation functions for individual scores based on given criteria
def calculate_volume_score(volume):
    if volume >= 10000:
        return 100
    if volume >= 1000:
        return 80
    if volume >= 100:
        return 50

    return 20

def calculate_cpc_score(cpc):
    if cpc >= 10:
        return 100
    if cpc >= 3:
        return 70
    return 30

def calculate_competition_score(competition):
    if competition == "LOW":
        return 100
    if competition == "MEDIUM":
        return 60

    return 30

def calculate_business_score(value):
    if value == "High":
        return 100
    if value == "Medium":
        return 60

    return 30
#=========================================

def save_scores(
    state,
    runtime,
):

    db = runtime.context.db

    for item in state["scores"]:

        topic = db.get(
            Topic,
            item["topic_id"]
        )

        topic.priority_score = item["score"]

        if item["score"] >= 80:
            topic.priority_level = "High"

        elif item["score"] >= 50:
            topic.priority_level = "Medium"

        else:
            topic.priority_level = "Low"

    db.commit()


    return {}


builder = StateGraph(
    TopicScoringState,
    context_schema=TopicScoringContext,
)

builder.add_node(
    "load_topics",
    load_topics,
)

builder.add_node(
    "load_metrics",
    load_metrics,
)

builder.add_node(
    "calculate_scores",
    calculate_scores,
)

builder.add_node(
    "save_scores",
    save_scores,
)

builder.add_edge(
    START,
    "load_topics",
)

builder.add_edge(
    "load_topics",
    "load_metrics",
)

builder.add_edge(
    "load_metrics",
    "calculate_scores",
)

builder.add_edge(
    "calculate_scores",
    "save_scores",
)

builder.add_edge(
    "save_scores",
    END,
)

topic_scoring_graph = builder.compile()