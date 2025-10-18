from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Your API Key
API_KEY = os.getenv('GOOGLE_API_KEY')

if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables!")

# Configure Gemini with API key
genai.configure(api_key=API_KEY)

# Create model instance
model = genai.GenerativeModel('gemini-2.0-flash-exp')  # Updated model name

SYSTEM_PROMPT = """
You are RampageAI, an advanced AI assistant specializing in finance. Always provide concise and accurate answers unless the user specifically requests detailed explanations. Communicate in clear, simple language, breaking down financial concepts so that users of any expertise level can understand.

Your guidance must:
- Be based on sound financial principles, current best practices, and reference credible sources when possible.
- Stay objective and impartial—never promote specific products, services, or brands.
- Fully respect user privacy and data security standards. Never request sensitive information unless essential and permitted.
- Avoid personalized investment or legal advice; instead, advise users to consult certified professionals for such needs.
- Support core financial tasks like budgeting, reporting, forecasting, risk assessment, cash flow analysis, and providing actionable financial insights.
- Ask clarifying questions if user input is ambiguous, and refine your answers based on user feedback or follow-up questions.
- Remain up-to-date with market trends and compliance requirements as relevant to queries.

Your main goal is to help users make confident, informed financial decisions with efficient and trustworthy support.
"""

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'message': 'RampageAI Chatbot API is running'
    }), 200

@app.route('/chat', methods=['POST'])
def chat():
    try:
        print("📩 Received chat request")
        data = request.get_json()
        print(f"📦 Request data: {data}")
        
        if not data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        user_message = data['message']
        user_context = data.get('context', {})
        
        print(f"💬 User message: {user_message}")
        print(f"🔍 Context: {user_context}")
        
        # Build context-aware prompt
        context_info = ""
        if user_context:
            if 'transactions' in user_context:
                context_info += f"\n\nUser's recent transactions:\n{user_context['transactions']}"
            if 'balance' in user_context:
                context_info += f"\n\nCurrent balance: ₹{user_context['balance']}"
            if 'monthly_expenses' in user_context:
                context_info += f"\n\nMonthly expenses: ₹{user_context['monthly_expenses']}"
            if 'monthly_income' in user_context:
                context_info += f"\nMonthly income: ₹{user_context['monthly_income']}"
        
        full_prompt = f"{SYSTEM_PROMPT}{context_info}\n\nUser: {user_message}"
        
        print("🤖 Calling Gemini API...")
        
        # Generate response with proper configuration
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=1024,
            )
        )
        
        print(f"✅ Got response from Gemini")
        
        return jsonify({
            'success': True,
            'response': response.text
        }), 200
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print(f"❌ ERROR TYPE: {type(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 RampageAI Chatbot API starting on port 5001...")
    print(f"📝 Using API Key: {API_KEY[:20]}...")  # Show first 20 chars only
    app.run(host='0.0.0.0', port=5001, debug=True)