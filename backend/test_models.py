import google.generativeai as genai

GEMINI_API_KEY = "AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI"
genai.configure(api_key=GEMINI_API_KEY)

print("--- Available Models for Key AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI ---")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Name: {m.name}")
except Exception as e:
    print(f"Error: {e}")
