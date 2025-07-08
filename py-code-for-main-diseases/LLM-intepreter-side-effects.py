import google.generativeai as genai

# Set your API key
genai.configure(api_key="AIzaSyDDZg49dNLbx7qxGC1aRcpcfLh2jbfXPFM")  # <-- replace with your key

# Select the Gemini model (e.g., gemini-1.5-flash or gemini-1.5-pro)
model = genai.GenerativeModel("gemini-1.5-flash")

# Example: Summarize a text
cell_content = "Here is the long text from your Excel cell..."

prompt = f"Summarize the following text in 2-3 sentences: {cell_content}"

response = model.generate_content(prompt)
summary = response.text

print(summary)  # <- Here you'll have the summary for your cell
