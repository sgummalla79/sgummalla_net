import os
from typing import Optional
import jwt
import chainlit as cl
from openai import AsyncOpenAI

_client = AsyncOpenAI()
_model = os.getenv("OPENAI_MODEL", "gpt-4o")
_jwt_secret = os.getenv("JWT_SECRET", "")


@cl.header_auth_callback
def header_auth_callback(headers: dict) -> Optional[cl.User]:
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[len("Bearer "):]
    try:
        payload = jwt.decode(token, _jwt_secret, algorithms=["HS256"])
        return cl.User(
            identifier=payload["email"],
            metadata={"name": payload.get("name", "")},
        )
    except Exception:
        return None


@cl.on_chat_start
async def start():
    cl.user_session.set("messages", [])


@cl.on_message
async def main(message: cl.Message):
    messages = cl.user_session.get("messages") or []
    messages.append({"role": "user", "content": message.content})

    response_msg = cl.Message(content="")
    await response_msg.send()

    stream = await _client.chat.completions.create(
        model=_model,
        messages=messages,
        stream=True,
    )

    async for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            await response_msg.stream_token(token)

    await response_msg.update()

    messages.append({"role": "assistant", "content": response_msg.content})
    cl.user_session.set("messages", messages)
