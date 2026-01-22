"""Quick vision model self-check.

Usage:
  python scripts/check_vision_model.py --model gpt-4o-mini --image https://example.com/cat.png --provider openai --api-key $OPENAI_API_KEY

Requirements:
  - Environment must have network access to provider.
  - For OpenAI-compatible: model must accept image_url in chat completions.
  - For Gemini: uses generative_models API via google.generativeai SDK.
"""

import argparse
import json
import sys


def run_openai(model: str, api_key: str, image_url: str):
    try:
        from openai import OpenAI
    except Exception:
        print("openai SDK not installed; pip install openai==1.*", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe the image succinctly."},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        max_tokens=200,
    )
    return resp.choices[0].message.content


def run_gemini(model: str, api_key: str, image_url: str):
    try:
        import google.generativeai as genai
    except Exception:
        print("google-generativeai not installed; pip install google-generativeai", file=sys.stderr)
        sys.exit(1)

    genai.configure(api_key=api_key)
    model_client = genai.GenerativeModel(model)
    resp = model_client.generate_content(
        [
          {"text": "Describe the image succinctly."},
          {"image_url": image_url},
        ]
    )
    return resp.text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--image", required=True, help="Image URL")
    parser.add_argument("--provider", choices=["openai", "gemini"], default="openai")
    parser.add_argument("--api-key", required=True)
    args = parser.parse_args()

    if args.provider == "openai":
        text = run_openai(args.model, args.api_key, args.image)
    else:
        text = run_gemini(args.model, args.api_key, args.image)

    print(json.dumps({"model": args.model, "provider": args.provider, "image": args.image, "summary": text}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
