import google.generativeai as genai

GEMINI_API_KEY = "AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI"
genai.configure(api_key=GEMINI_API_KEY)

model_name = "gemma-3-27b-it"
print(f"--- Testing {model_name} ---")
try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hello")
    print(f"Success for {model_name}: {response.text[:20]}...")
except Exception as e:
    print(f"Error with {model_name}: {e}")
