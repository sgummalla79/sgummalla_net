import os
import chainlit as cl
from openai import AsyncOpenAI

_client = AsyncOpenAI()
_model = os.getenv("OPENAI_MODEL", "gpt-4o")


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
