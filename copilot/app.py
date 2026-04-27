import os
from typing import Optional, Dict
import jwt
import chainlit as cl
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

COPILOT_AUTH_SECRET = os.environ["COPILOT_AUTH_SECRET"]


@cl.header_auth_callback
def header_auth_callback(headers: Dict) -> Optional[cl.User]:
    token = headers.get("x-copilot-token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, COPILOT_AUTH_SECRET, algorithms=["HS256"])
        return cl.User(
            identifier=payload["identifier"],
            metadata={
                "name": payload.get("name", payload["identifier"]),
                "email": payload.get("email", ""),
            },
        )
    except jwt.PyJWTError:
        return None


@cl.on_chat_start
async def on_chat_start():
    user = cl.user_session.get("user")
    name = user.metadata.get("name", "there") if user else "there"
    await cl.Message(content=f"Hi {name}! How can I help you today?").send()
    cl.user_session.set("history", [])


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
    async for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        await reply.stream_token(delta)

    await reply.send()
    history.append({"role": "assistant", "content": reply.content})
    cl.user_session.set("history", history)
