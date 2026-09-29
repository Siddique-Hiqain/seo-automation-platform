from dataclasses import dataclass
from langgraph.graph import (
    END,
    START,
    StateGraph,
)
from langgraph.runtime import Runtime
from sqlalchemy.orm import Session
from typing_extensions import TypedDict
from app.providers.llm.base import LLMProvider
from app.services.semantic_search import semantic_search


class WebsiteQAState(TypedDict):
    website_id: int
    question: str
    retrieved_chunks: list[dict]
    context: str
    answer: str

@dataclass
class WebsiteQAContext:
    db: Session
    llm: LLMProvider


def retrieve_knowledge(
    state: WebsiteQAState,
    runtime: Runtime[WebsiteQAContext],
) -> dict:

    results = semantic_search(
        db=runtime.context.db,
        website_id=state["website_id"],
        query=state["question"],
        limit=5,
    )

    context_parts: list[str] = []

    for index, result in enumerate(
        results,
        start=1,
    ):
        context_parts.append(
            (
                f"[Source {index}]\n"
                f"Title: {result['title']}\n"
                f"URL: {result['url']}\n"
                f"Content:\n{result['content']}"
            )
        )

    context = "\n\n".join(
        context_parts
    )

    return {
        "retrieved_chunks": results,
        "context": context,
    }

def generate_answer(
    state: WebsiteQAState,
    runtime: Runtime[WebsiteQAContext],
) -> dict:

    retrieved_chunks = state.get(
        "retrieved_chunks",
        [],
    )

    if not retrieved_chunks:
        return {
            "answer": (
                "I could not find enough information "
                "on this website to answer the question."
            )
        }

    system_prompt = """
You answer questions using only the website context provided.

Rules:
- Use only information supported by the provided context.
- Do not invent facts.
- If the context does not contain the answer, say that clearly.
- Keep the answer concise and useful.
- Do not claim knowledge from outside the supplied website context.
""".strip()

    user_prompt = f"""
Question:
{state["question"]}

Website context:
{state["context"]}

Answer the question using only the website context.
""".strip()

    answer = runtime.context.llm.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    return {
        "answer": answer,
    }


builder = StateGraph(
    WebsiteQAState,
    context_schema=WebsiteQAContext,
)

builder.add_node(
    "retrieve_knowledge",
    retrieve_knowledge,
)

builder.add_node(
    "generate_answer",
    generate_answer,
)

builder.add_edge(
    START,
    "retrieve_knowledge",
)

builder.add_edge(
    "retrieve_knowledge",
    "generate_answer",
)

builder.add_edge(
    "generate_answer",
    END,
)


website_qa_graph = builder.compile()