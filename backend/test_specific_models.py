import google.generativeai as genai

GEMINI_API_KEY = "AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI"
genai.configure(api_key=GEMINI_API_KEY)

model_name = "gemini-1.5-flash"
print(f"--- Testing {model_name} ---")
try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hello")
    print(f"Success: {response.text}")
except Exception as e:
    print(f"Error with {model_name}: {e}")

model_name = "gemini-2.0-flash"
print(f"--- Testing {model_name} ---")
try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hello")
    print(f"Success: {response.text}")
except Exception as e:
    print(f"Error with {model_name}: {e}")
