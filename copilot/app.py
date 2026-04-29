import os
import re
from typing import Optional, Dict
import jwt
import chainlit as cl
from chainlit.data import get_data_layer
from chainlit.data.sql_alchemy import SQLAlchemyDataLayer
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

CHAINLIT_AUTH_SECRET = os.environ["CHAINLIT_AUTH_SECRET"]

# ── Persistence ───────────────────────────────────────────────────────────────
# Convert the Node-style postgres:// URL to the asyncpg dialect.
# Neon requires SSL; asyncpg handles it via ssl=True in connect_args.
_raw_url = os.environ["NEON_DB_URL"]
_conninfo = re.sub(r"^postgresql://", "postgresql+asyncpg://", _raw_url)
# Strip query params asyncpg doesn't understand (sslmode, channel_binding)
_conninfo = re.sub(r"\?.*$", "", _conninfo)


@cl.data_layer
def get_data_layer():
    return SQLAlchemyDataLayer(
        conninfo=_conninfo,
        ssl_require=True,
    )


# ── Auth ──────────────────────────────────────────────────────────────────────

@cl.header_auth_callback
def header_auth_callback(headers: Dict) -> Optional[cl.User]:
    token = headers.get("x-copilot-token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, CHAINLIT_AUTH_SECRET, algorithms=["HS256"])
        return cl.User(
            identifier=payload["identifier"],
            metadata={
                "name": payload.get("name", payload["identifier"]),
                "email": payload.get("email", ""),
                # Use brand icon as profile picture when the user has no photo.
                # Chainlit renders user.metadata["image"] as the avatar src.
                "image": "/copilot/public/avatar.png",
            },
        )
    except jwt.PyJWTError:
        return None


# ── Chat lifecycle ────────────────────────────────────────────────────────────

@cl.on_chat_start
async def on_chat_start():
    """Called when a brand-new thread begins."""
    user = cl.user_session.get("user")
    name = user.metadata.get("name", "there") if user else "there"
    cl.user_session.set("history", [])
    await cl.Message(content=f"Hi {name}! How can I help you today?").send()


@cl.on_chat_resume
async def on_chat_resume(thread: cl.types.ThreadDict):
    """Called when an existing thread is resumed from persistence.
    Reconstructs the in-memory message history so the LLM has full context.
    """
    history = []
    for step in thread.get("steps", []):
        if step.get("type") == "user_message" and step.get("output"):
            history.append({"role": "user", "content": step["output"]})
        elif step.get("type") == "assistant_message" and step.get("output"):
            history.append({"role": "assistant", "content": step["output"]})
    cl.user_session.set("history", history)


@cl.on_message
async def on_message(message: cl.Message):
    history: list = cl.user_session.get("history", [])
    history.append({"role": "user", "content": message.content})

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful AI assistant."},
            *history,
        ],
        stream=True,
    )

    reply = cl.Message(content="")
    await reply.send()                           # creates UI placeholder first
    async for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        await reply.stream_token(delta)
    await reply.update()                         # finalises UI display

    # Explicitly await the data layer write — reply.update() fires it as
    # asyncio.create_task (fire-and-forget) which can be GC'd before completion.
    data_layer = get_data_layer()
    if data_layer:
        await data_layer.update_step(reply.to_dict())
    history.append({"role": "assistant", "content": reply.content})
    cl.user_session.set("history", history)
