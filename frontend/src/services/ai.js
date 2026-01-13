import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;
let model = null;

export const initializeGemini = (apiKey) => {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

export const sendMessageToGemini = async (history, message) => {
    if (!model) {
        throw new Error("API Key chưa được thiết lập");
    }

    // Convert chat history map to Gemini format
    // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
    const formattedHistory = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
            maxOutputTokens: 1000,
        },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
};

export const sendMessageToOllama = async (history, message, modelName = "llama3") => {
    // Convert chat history to Ollama format: { role: "user" | "assistant", content: "..." }
    const messages = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));

    // Add current message
    messages.push({ role: 'user', content: message });

    try {
        const response = await fetch('/api/ollama/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                stream: false, // For simplicity now, we use non-streaming
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama Error: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        return data.message.content;
    } catch (error) {
        console.error("Ollama API Error:", error);
        throw error;
    }
};

export const sendMessageToOpenAICompatible = async (history, message, baseUrl, modelId) => {
    // Generic handler for LM Studio, LocalAI, etc.
    // Expects baseUrl like 'http://localhost:1234/v1'

    const messages = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    messages.push({ role: 'user', content: message });

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelId || "local-model",
                messages: messages,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`Local Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        // OpenAI format: choices[0].message.content
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Custom Local API Error:", error);
        throw error;
    }
};
export const sendMessageStreaming = async (history, message, baseUrl, modelId, searchWeb = false, deviceId = "unknown", onToken) => {
    const messages = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    messages.push({ role: 'user', content: message });

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelId || "local-model",
                messages: messages,
                temperature: 0.7,
                stream: true,
                search_web: searchWeb,
                device_id: deviceId
            }),
        });

        if (!response.ok) {
            throw new Error(`Local Server Error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let lines = buffer.split("\n\n");
            buffer = lines.pop(); // Keep the partial line (if any) in the buffer

            for (const line of lines) {
                const cleanLine = line.replace(/^data: /, "").trim();
                if (!cleanLine) continue;
                if (cleanLine === "[DONE]") return fullText;

                try {
                    const data = JSON.parse(cleanLine);
                    const token = data.choices[0]?.delta?.content || "";
                    if (token) {
                        fullText += token;
                        onToken(fullText);
                    }
                } catch (e) {
                    console.warn("Failed to parse SSE data:", cleanLine, e);
                }
            }
        }
        return fullText;
    } catch (error) {
        console.error("Streaming API Error:", error);
        throw error;
    }
};
