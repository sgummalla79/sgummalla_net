from openai import AsyncOpenAI
import chainlit as cl

client = AsyncOpenAI()


@cl.on_chat_start
async def on_chat_start():
    cl.user_session.set("history", [])
    await cl.Message(
        content="Hi! I'm your AI copilot. How can I help you today?"
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    history = cl.user_session.get("history")
    history.append({"role": "user", "content": message.content})

    response = cl.Message(content="")
    await response.send()

    stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=history,
        stream=True,
    )

    full_response = ""
    async for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        full_response += token
        await response.stream_token(token)

    await response.update()
    history.append({"role": "assistant", "content": full_response})
    cl.user_session.set("history", history)
