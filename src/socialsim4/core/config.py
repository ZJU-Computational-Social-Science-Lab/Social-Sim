"""Core configuration constants for SocialSim4.

Prototype-stage: minimal globals toggled at simulation build time.
"""

# LLM retry attempts per action parse (1 + MAX_REPEAT total attempts)
MAX_REPEAT = 3

# Emotion tracking toggle. When true, agents include an Emotion Update block
# each turn and the system records `emotion_update` events.
EMOTION_ENABLED = False
