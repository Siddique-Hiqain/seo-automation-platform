import json
from typing_extensions import TypedDict
from dataclasses import dataclass
from sqlalchemy.orm import Session
from langgraph.graph import (
    StateGraph,
    START,
    END,
)
from app.providers.llm.base import LLMProvider
from sqlalchemy import select
from app.models.topic import Topic
from app.models.keyword_metric import KeywordMetric
from app.models.article import Article
from app.services.semantic_search import semantic_search


class ArticleWriterState(TypedDict):
    topic_id: int
    topic: dict
    keywords: list[dict]
    context: list[str]
    article: dict

@dataclass
class ArticleWriterContext:
    db: Session
    llm: LLMProvider


def load_topic(
    state,
    runtime,
):

    topic = runtime.context.db.scalar(
        select(Topic)
        .where(
            Topic.id == state["topic_id"]
        )
    )

    return {
        "topic": {
            "id": topic.id,
            "website_id": topic.website_id,
            "title": topic.title,
            "keyword_ideas": topic.keyword_ideas,
            "business_value": topic.business_value,
            "reasoning": topic.reasoning,
        }
    }

def load_keywords(
    state,
    runtime,
):

    metrics = runtime.context.db.scalars(
        select(KeywordMetric)
        .where(
            KeywordMetric.topic_id ==
            state["topic_id"]
        )
    ).all()

    return {
        "keywords": [
            {
                "keyword": metric.keyword,
                "search_volume": metric.search_volume,
                "cpc": metric.cpc,
                "competition": metric.competition,
            }
            for metric in metrics
        ]
    }

def retrieve_context(
    state,
    runtime,
):

    results = semantic_search(
        db=runtime.context.db,
        website_id=state["topic"]["website_id"],
        query=state["topic"]["title"],
        limit=5,
    )

    context = [
        item["content"]
        for item in results
    ]

    return {
        "context": context
    }

def generate_article(
    state,
    runtime,
):

    prompt = f"""
Create an SEO optimized article.

Topic:
{state["topic"]}


Target keywords:
{state["keywords"]}


Website context:
{state["context"]}


Requirements:

- Write a complete long-form article.
- Match the website's services and audience.
- Use the provided keywords naturally.
- Do not mention AI.
- Include:
    - title
    - meta title
    - meta description
    - article content
    - FAQs


Return ONLY JSON.

Format:

{{
"title":"",
"meta_title":"",
"meta_description":"",
"content":"",
"faq":[]
}}

"""

    answer = runtime.context.llm.generate(
        "You are an expert SEO content writer.",
        prompt,
    )

    article = json.loads(
        answer
    )

    return {
        "article": article
    }

def save_article(
    state,
    runtime,
):

    article_data = state["article"]

    db = runtime.context.db

    article = Article(
        website_id=state["topic"]["website_id"],
        topic_id=state["topic"]["id"],
        title=article_data["title"],
        meta_title=article_data["meta_title"],
        meta_description=article_data["meta_description"],
        content=article_data["content"],
        faq=article_data.get(
            "faq"
        ),
        status="draft",
    )

    db.add(article)
    db.commit()
    db.refresh(article)


    return {
        "article": {
            **article_data,
            "id": article.id
        }
    }


builder = StateGraph(
    ArticleWriterState,
    context_schema=ArticleWriterContext,
)

builder.add_node(
    "load_topic",
    load_topic,
)

builder.add_node(
    "load_keywords",
    load_keywords,
)

builder.add_node(
    "retrieve_context",
    retrieve_context,
)

builder.add_node(
    "generate_article",
    generate_article,
)

builder.add_node(
    "save_article",
    save_article,
)

builder.add_edge(
    START,
    "load_topic",
)

builder.add_edge(
    "load_topic",
    "load_keywords",
)

builder.add_edge(
    "load_keywords",
    "retrieve_context",
)

builder.add_edge(
    "retrieve_context",
    "generate_article",
)

builder.add_edge(
    "generate_article",
    "save_article",
)

builder.add_edge(
    "save_article",
    END,
)

article_writer_graph = builder.compile()