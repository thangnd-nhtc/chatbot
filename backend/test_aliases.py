import google.generativeai as genai

GEMINI_API_KEY = "AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI"
genai.configure(api_key=GEMINI_API_KEY)

models_to_test = ["gemini-pro-latest", "gemini-flash-latest", "gemini-1.5-flash-8b", "gemini-2.0-flash-lite"]

for model_name in models_to_test:
    print(f"--- Testing {model_name} ---")
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hello")
        print(f"Success for {model_name}: {response.text[:20]}...")
    except Exception as e:
        print(f"Error with {model_name}: {e}")
