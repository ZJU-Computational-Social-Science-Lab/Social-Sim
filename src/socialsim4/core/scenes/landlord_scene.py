import random
from typing import Dict, List, Optional, Tuple

from socialsim4.core.actions.base_actions import SendMessageAction, YieldAction
from socialsim4.core.actions.landlord_actions import (
    CallLandlordAction,
    DoubleAction,
    NoDoubleAction,
    PassAction,
    PlayCardsAction,
    RobLandlordAction,
)
from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.scene import Scene
from socialsim4.core.simulator import Simulator

RANK_ORDER = [
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
    "2",
    "SJ",
    "BJ",
]
RANK_VALUE = {r: i for i, r in enumerate(RANK_ORDER, start=3)}


class LandlordPokerScene(Scene):
    TYPE = "landlord_scene"

    def __init__(
        self,
        name: str,
        initial_event: str,
        seed: Optional[int] = None,
        num_decks: int = 1,
    ):
        super().__init__(name, initial_event)
        if num_decks not in (1, 2):
            raise ValueError("num_decks must be 1 or 2")
        self.num_decks = num_decks
        self.state.update(
            {
                "phase": "init",  # init | bidding | playing | complete
                "players": [],
                "bottom": [],
                "hands": {},  # name -> {rank->count}
                "bidding_stage": "call",  # call | rob
                "bid_turn_index": 0,
                "landlord_candidate": None,
                "landlord": None,
                "farmers": [],
                "current_turn": 0,
                "leading_combo": None,
                "passes_since_play": 0,
                "score_multiplier": 1,
                "rob_eligible": [],
                "rob_acted": {},
                "played_flags": {},  # name -> bool (played any cards)
                # Per-turn chat allowance
                "turn_msg_used": {},  # name -> bool
                # Doubling stage
                "doubling_order": [],
                "doubling_acted": {},
                "complete": False,
                "winner_team": None,
            }
        )
        self._rng = random.Random(seed)
        # Each player turn advances time by 1 minute for transcript readability
        self.minutes_per_turn = 1

    # ----- Scene protocol -----
    def get_scenario_description(self):
        if self.num_decks == 1:
            deal = (
                "Each player is dealt 13 cards; 2 cards are set aside as bottom cards."
            )
            deck_desc = "one standard 54-card deck"
        else:
            deal = (
                "Each player is dealt 25 cards; 8 cards are set aside as bottom cards."
            )
            deck_desc = "two standard 54-card decks (108 cards total)"
        return (
            f"You are playing four-player Dou Dizhu (Landlord) with {deck_desc} (ranks 3-A, 2, small joker SJ, big joker BJ). "
            f"{deal} Bottom cards are added to the landlord's hand after bidding. Suits are ignored; only ranks and counts matter."
        )

    def get_behavior_guidelines(self):
        return (
            "Follow these rules strictly:\n"
            + (
                "- Deck and dealing: One standard 54-card deck. Suits are ignored; only ranks and counts matter. Each player gets 13 cards; 2 cards remain as bottom cards and are added to the landlord's hand after bidding.\n"
                if self.num_decks == 1
                else "- Deck and dealing: Two standard 54-card decks (108 cards total). Suits are ignored; only ranks and counts matter. Each player gets 25 cards; 8 cards remain as bottom cards and are added to the landlord's hand after bidding.\n"
            )
            + "- Call/Rob landlord: In seat order, each player may call once. Once someone calls, the other three each have exactly one chance to rob. The last caller/robber becomes the landlord. If everyone passes on calling, redeal. Each rob doubles the global multiplier (x2).\n"
            + "- Doubling: After the landlord is decided, a doubling stage runs (farmers in seat order, then the landlord). Each player may choose to double once (x2) or skip.\n"
            + "- Playing: The landlord leads. If there is no lead, the current player must lead a legal combination. Otherwise, you must beat the current lead with the SAME type and SAME length. Bombs beat any non-bomb; the rocket beats everything. The leader cannot pass.\n"
            + "- End and win: The game ends immediately when any player runs out of cards. If the landlord goes out first, the landlord team wins; otherwise the farmers win.\n"
            + "- Multipliers: Start at x1. Each rob, each bomb, each rocket, and each double multiplies by x2. Spring (landlord wins before any farmer plays) and Counter-Spring (a farmer wins before the landlord plays) also apply x2.\n"
            + (
                "- Allowed combinations (strict): Single; Pair; Triple; Triple+Single; Triple+Pair; Straight (≥5, ranks 3..A only; cannot include 2/SJ/BJ); Double Sequence (≥3 consecutive pairs, cannot include 2/SJ/BJ); Triple Sequence (≥2 consecutive triples); Airplane+Singles (m triples + m singles, attachments cannot reuse the triple ranks); Airplane+Pairs (m triples + m pairs, attachments cannot reuse the triple ranks); Four-with-two singles; Four-with-two pairs; Bomb (four-of-a-kind); Rocket (SJ+BJ).\n"
                if self.num_decks == 1
                else "- Allowed combinations (strict): Single; Pair; Triple; Triple+Single; Triple+Pair; Straight (≥5, ranks 3..A only; cannot include 2/SJ/BJ); Double Sequence (≥3 consecutive pairs, cannot include 2/SJ/BJ); Triple Sequence (≥2 consecutive triples); Airplane+Singles (m triples + m singles, attachments cannot reuse the triple ranks); Airplane+Pairs (m triples + m pairs, attachments cannot reuse the triple ranks); Four-with-two singles; Four-with-two pairs; Bomb (four‑of‑a‑kind or eight‑of‑a‑kind); Rocket (SJ+BJ). Among bombs, longer bombs outrank shorter ones; if equal length, compare rank.\n"
            )
            + "- Tokens and format: Use only these rank tokens, space-separated: 3 4 5 6 7 8 9 10 J Q K A 2 SJ BJ.\n"
            + "- Interaction: During your turn you can interact with others via send_message action.\n"
        )

    def initialize_agent(self, agent: Agent):
        # Track play flags
        self.state.setdefault("played_flags", {})[agent.name] = False

    def get_scene_actions(self, agent: Agent):
        return [
            CallLandlordAction(),
            RobLandlordAction(),
            DoubleAction(),
            NoDoubleAction(),
            PlayCardsAction(),
            SendMessageAction(),
            PassAction(),
            YieldAction(),
        ]

    def pre_run(self, simulator: Simulator):
        players = list(simulator.agents.keys())
        if len(players) != 4:
            raise ValueError("LandlordPokerScene requires exactly 4 agents.")
        self.state["players"] = players
        # Initialize per-turn chat usage tracking
        self.state["turn_msg_used"] = {p: False for p in players}
        self._redeal(simulator)

    def should_skip_turn(self, agent: Agent, simulator: Simulator) -> bool:
        # Using ControlledOrdering to schedule the correct agent; no skip logic needed.
        return False

    def is_complete(self):
        return bool(self.state.get("complete", False))

    def post_turn(self, agent: Agent, simulator: Simulator):
        # Advance time and reset this agent's chat allowance for next turn
        super().post_turn(agent, simulator)
        tmu = self.state.get("turn_msg_used") or {}
        if agent.name in tmu:
            tmu[agent.name] = False
            self.state["turn_msg_used"] = tmu

    def get_agent_status_prompt(self, agent: Agent) -> str:
        phase = self.state.get("phase")
        you = agent.name
        # Expand your hand to tokens, sorted by rank
        h = self.state.get("hands", {}).get(you, {})
        tokens: List[str] = []
        for r in RANK_ORDER:
            c = h.get(r, 0)
            if c:
                tokens.extend([r] * c)
        hand_str = " ".join(tokens) if tokens else "(empty)"

        lines = [
            "--- Status ---",
            f"Phase: {phase}",
            f"Multiplier: x{self.state.get('score_multiplier', 1)}",
            f"Hand: {hand_str}",
        ]
        # Show per-player hand counts (no card identities revealed)
        players = self.state.get("players") or []
        hands = self.state.get("hands", {})
        counts = [f"{n}={sum(hands.get(n, {}).values())}" for n in players]
        if counts:
            lines.append("Hand counts: " + " | ".join(counts))
        return "\n".join(lines) + "\n"

    def get_controlled_next(self, simulator: Simulator) -> str | None:
        s = self.state
        p = s.get("phase")
        if p == "bidding":
            if s.get("bidding_stage") == "call":
                i = s.get("bid_turn_index")
                return (s.get("players") or [None])[i] if i is not None else None
            # rob stage: find next eligible who hasn't acted
            elig = list(s.get("rob_eligible") or [])
            acted = dict(s.get("rob_acted") or {})
            if not elig:
                return None
            names = list(s.get("players") or [])
            start = s.get("bid_turn_index") or 0
            n = len(names)
            for off in range(n):
                idx = (start + off) % n
                nm = names[idx]
                if nm in elig and not bool(acted.get(nm, False)):
                    return nm
            return None
        if p == "doubling":
            order = list(s.get("doubling_order") or [])
            acted = dict(s.get("doubling_acted") or {})
            if not order:
                return None
            for nm in order:
                if not bool(acted.get(nm, False)):
                    return nm
            return None
        if p == "playing":
            i = s.get("current_turn") or 0
            return (s.get("players") or [None])[i] if i is not None else None
        return None

    def parse_and_handle_action(self, action_data, agent: Agent, simulator: Simulator):
        # Enforce: at most one message per turn per agent
        if action_data and action_data.get("action") == "send_message":
            tmu = self.state.get("turn_msg_used") or {}
            if tmu.get(agent.name, False):
                agent.add_env_feedback("You have already sent a message this turn.")
                return (
                    False,
                    {"error": "message_already_sent"},
                    f"{agent.name} extra chat blocked",
                    {},
                    False,
                )
            success, result, summary, meta, pass_control = (
                super().parse_and_handle_action(action_data, agent, simulator)
            )
            if success:
                tmu[agent.name] = True
                self.state["turn_msg_used"] = tmu
            return success, result, summary, meta, pass_control
        return super().parse_and_handle_action(action_data, agent, simulator)

    # ----- Bidding helpers -----
    def _redeal(self, simulator: Simulator):
        players = list(self.state.get("players"))
        deck = self._build_deck()
        self._rng.shuffle(deck)
        hands: Dict[str, Dict[str, int]] = {p: {} for p in players}

        # Deal depending on deck count
        if self.num_decks == 1:
            per = 13
            bottom_n = 2
        else:
            per = 25
            bottom_n = 8

        for i in range(per * len(players)):
            p = players[i % len(players)]
            r = deck[i]
            hands[p][r] = hands[p].get(r, 0) + 1
        bottom = deck[per * len(players) : per * len(players) + bottom_n]

        self.state["bottom"] = bottom
        self.state["hands"] = hands
        self.state["phase"] = "bidding"
        self.state["bidding_stage"] = "call"
        self.state["bid_turn_index"] = 0
        self.state["landlord_candidate"] = None
        self.state["landlord"] = None
        self.state["farmers"] = []
        self.state["current_turn"] = 0
        self.state["leading_combo"] = None
        self.state["passes_since_play"] = 0
        self.state["score_multiplier"] = 1
        self.state["rob_eligible"] = []
        self.state["rob_acted"] = {}
        self.state["played_flags"] = {p: False for p in players}
        # Emit a structured log event revealing each player's full hand and bottom (for debugging/analysis)
        hands_tokens = {}
        for p in players:
            h = self.state["hands"][p]
            toks: List[str] = []
            for r in RANK_ORDER:
                c = h.get(r, 0)
                if c:
                    toks.extend([r] * c)
            hands_tokens[p] = toks
        simulator.emit_event(
            "landlord_deal",
            {
                "players": hands_tokens,
                "bottom": list(self.state["bottom"]),
            },
        )
        simulator.broadcast(PublicEvent("New deal. Call the landlord begins."))

    def _finalize_landlord(self, simulator: Simulator):
        name = self.state.get("landlord_candidate")
        if not name:
            # No one called/robbed → redeal
            self._redeal(simulator)
            return
        self.state["landlord"] = name
        farmers = [p for p in self.state.get("players") if p != name]
        self.state["farmers"] = farmers
        # Give bottom cards to landlord
        for r in list(self.state.get("bottom")):
            self.state["hands"][name][r] = self.state["hands"][name].get(r, 0) + 1
        bottom_str = " ".join(self.state.get("bottom"))
        simulator.broadcast(
            PublicEvent(f"Landlord is {name}. Bottom cards: {bottom_str}")
        )
        # Doubling stage before playing: farmers first (in table order), landlord last
        players = list(self.state.get("players"))
        li = players.index(name)
        order = []
        for i in range(1, len(players)):
            order.append(players[(li + i) % len(players)])
        order.append(name)
        self.state["doubling_order"] = order
        self.state["doubling_acted"] = {p: False for p in order}
        self.state["phase"] = "doubling"

    def _advance_call_pass(self, simulator: Simulator):
        # When all 4 declined to call, redeal
        idx = self.state.get("bid_turn_index")
        players = self.state.get("players")
        next_idx = (idx + 1) % len(players)
        # If we've wrapped to 0 and no one called, redeal
        wrapped = next_idx == 0
        self.state["bid_turn_index"] = next_idx
        if wrapped and self.state.get("landlord_candidate") is None:
            simulator.broadcast(PublicEvent("No one called. Redealing."))
            self._redeal(simulator)

    # ----- Playing turn helpers -----
    def _advance_turn(self):
        self.state["current_turn"] = (self.state.get("current_turn") + 1) % len(
            self.state.get("players")
        )

    def _on_player_pass(self, simulator: Simulator):
        self.state["passes_since_play"] = (
            int(self.state.get("passes_since_play", 0)) + 1
        )
        if self.state["passes_since_play"] >= (len(self.state.get("players")) - 1):
            # Trick ends; leader starts next
            owner = self.state.get("leading_combo").get("owner")
            self.state["current_turn"] = self.state.get("players").index(owner)
            self.state["leading_combo"] = None
            self.state["passes_since_play"] = 0
            simulator.broadcast(PublicEvent(f"Trick ends. {owner} leads next."))
        else:
            self._advance_turn()

    def _on_player_won(self, winner: str, simulator: Simulator):
        landlord = self.state.get("landlord")
        farmers = self.state.get("farmers")
        # Spring / Counter-spring
        if winner == landlord:
            farmers_played = any(
                self.state.get("played_flags", {}).get(p, False) for p in farmers
            )
            if not farmers_played:
                self.state["score_multiplier"] = (
                    int(self.state.get("score_multiplier", 1)) * 2
                )
                simulator.broadcast(PublicEvent("Spring! Multiplier doubled."))
            self.state["winner_team"] = "landlord"
        else:
            landlord_played = bool(
                self.state.get("played_flags", {}).get(landlord, False)
            )
            if not landlord_played:
                self.state["score_multiplier"] = (
                    int(self.state.get("score_multiplier", 1)) * 2
                )
                simulator.broadcast(PublicEvent("Counter-spring! Multiplier doubled."))
            self.state["winner_team"] = "farmers"
        self.state["phase"] = "complete"
        self.state["complete"] = True
        mult = self.state.get("score_multiplier", 1)
        simulator.broadcast(
            PublicEvent(f"Game over. Winner: {self.state['winner_team']} (x{mult}).")
        )

    # ----- Hand utilities -----
    def _build_deck(self) -> List[str]:
        single = []
        for r in RANK_ORDER:
            if r in ("SJ", "BJ"):
                single.append(r)
            else:
                # four suits collapsed; keep counts only
                single.extend([r, r, r, r])
        return single * int(getattr(self, "num_decks", 1) or 1)

    def _parse_cards_str(self, s: str) -> List[str]:
        parts = [p.strip() for p in s.strip().split(" ") if p.strip()]
        # strict tokens only
        for p in parts:
            if p not in RANK_ORDER:
                raise ValueError("Unknown card token: " + p)
        return parts

    def _has_cards(self, name: str, tokens: List[str]) -> bool:
        hand = self.state.get("hands")[name]
        counts: Dict[str, int] = {}
        for t in tokens:
            counts[t] = counts.get(t, 0) + 1
        for r, c in counts.items():
            if hand.get(r, 0) < c:
                return False
        return True

    def _remove_cards(self, name: str, tokens: List[str]):
        hand = self.state.get("hands")[name]
        for t in tokens:
            hand[t] = hand.get(t, 0) - 1
            if hand[t] == 0:
                del hand[t]
        # Mark that this player has played at least once
        self.state.setdefault("played_flags", {})[name] = True

    def _hand_size(self, name: str) -> int:
        hand = self.state.get("hands")[name]
        return sum(hand.values())

    # ----- Combination evaluation -----
    def _evaluate_combo(self, tokens: List[str]) -> Optional[Dict]:
        n = len(tokens)
        counts: Dict[str, int] = {}
        for t in tokens:
            counts[t] = counts.get(t, 0) + 1
        ranks_sorted = sorted(counts.keys(), key=lambda r: RANK_VALUE[r])

        def is_consecutive(rs: List[str]) -> bool:
            # No 2 or jokers in straights
            if any(r in ("2", "SJ", "BJ") for r in rs):
                return False
            vals = [RANK_VALUE[r] for r in rs]
            for i in range(1, len(vals)):
                if vals[i] != vals[i - 1] + 1:
                    return False
            return True

        # Rocket
        if n == 2 and set(tokens) == {"SJ", "BJ"}:
            return {"type": "rocket", "key": "BJ", "len": 2}

        # Bomb: four-of-a-kind (always); eight-of-a-kind if using two decks
        if len(counts) == 1:
            r = ranks_sorted[0]
            c = list(counts.values())[0]
            if c == 4 or (getattr(self, "num_decks", 1) == 2 and c == 8):
                return {"type": "bomb", "key": r, "len": c}

        # Four-with-two singles
        if n == 6:
            quad = [r for r, c in counts.items() if c == 4]
            if len(quad) == 1:
                q = quad[0]
                others = sum(c for r, c in counts.items() if r != q)
                if others == 2:
                    return {"type": "four_two_singles", "key": q, "len": 6}

        # Four-with-two pairs
        if n == 8:
            quad = [r for r, c in counts.items() if c == 4]
            if len(quad) == 1:
                q = quad[0]
                pairs = [r for r, c in counts.items() if r != q and c == 2]
                if len(pairs) == 2:
                    return {"type": "four_two_pairs", "key": q, "len": 8}

        # Triples and attachments
        if n == 3 and len(counts) == 1 and list(counts.values())[0] == 3:
            r = ranks_sorted[0]
            return {"type": "triple", "key": r, "len": 3}
        if n == 4:
            triple_r = [r for r, c in counts.items() if c == 3]
            if len(triple_r) == 1:
                return {"type": "triple_single", "key": triple_r[0], "len": 4}
        if n == 5:
            triple_r = [r for r, c in counts.items() if c == 3]
            pair_r = [r for r, c in counts.items() if c == 2]
            if len(triple_r) == 1 and len(pair_r) == 1 and triple_r[0] != pair_r[0]:
                return {"type": "triple_pair", "key": triple_r[0], "len": 5}

        # Singles and pairs
        if n == 1:
            r = tokens[0]
            return {"type": "single", "key": r, "len": 1}
        if n == 2 and len(counts) == 1:
            r = ranks_sorted[0]
            return {"type": "pair", "key": r, "len": 2}

        # Straight singles (>=5)
        if n >= 5 and len(counts) == n:
            if is_consecutive(ranks_sorted):
                return {"type": "straight", "key": ranks_sorted[-1], "len": n}

        # Double sequence (>=3 pairs)
        if n % 2 == 0:
            pair_ranks = [r for r, c in counts.items() if c == 2]
            if len(pair_ranks) * 2 == n:
                ps = sorted(pair_ranks, key=lambda r: RANK_VALUE[r])
                if len(ps) >= 3 and is_consecutive(ps):
                    return {"type": "double_seq", "key": ps[-1], "len": n}

        # Triple sequence (>=2 triples) and airplanes
        triple_ranks = [r for r, c in counts.items() if c == 3]
        if triple_ranks:
            ts = sorted(triple_ranks, key=lambda r: RANK_VALUE[r])
            if len(ts) >= 2 and is_consecutive(ts):
                m = len(ts)
                if n == m * 3:
                    return {"type": "triple_seq", "key": ts[-1], "len": n, "m": m}
                # airplane + singles
                if n == m * 4:
                    # verify attachments exclude triple ranks
                    attach = []
                    for r, c in counts.items():
                        if r not in ts:
                            attach.extend([r] * c)
                    if len(attach) == m:
                        return {
                            "type": "airplane_singles",
                            "key": ts[-1],
                            "len": n,
                            "m": m,
                        }
                # airplane + pairs
                if n == m * 5:
                    pairs = [r for r, c in counts.items() if r not in ts and c == 2]
                    if len(pairs) == m:
                        pr = sorted(pairs, key=lambda r: RANK_VALUE[r])
                        return {
                            "type": "airplane_pairs",
                            "key": ts[-1],
                            "len": n,
                            "m": m,
                            "pair_top": pr[-1],
                        }

        return None

    def _can_beat(self, c1: Dict, c2: Dict) -> bool:
        # Rocket beats everything
        if c1["type"] == "rocket":
            return True
        if c2["type"] == "rocket":
            return False
        # Bomb beats any non-bomb
        if c1["type"] == "bomb":
            if c2["type"] != "bomb":
                return True
            # Both bombs: longer bombs outrank shorter ones; if equal, compare rank
            l1 = int(c1.get("len", 4))
            l2 = int(c2.get("len", 4))
            if l1 != l2:
                return l1 > l2
            return RANK_VALUE[c1["key"]] > RANK_VALUE[c2["key"]]
        if c2["type"] == "bomb":
            return False
        # Else must be same type and compatible length
        if c1["type"] != c2["type"]:
            return False
        # Sequences must match length
        if c1.get("len") != c2.get("len"):
            return False
        return RANK_VALUE[c1["key"]] > RANK_VALUE[c2["key"]]

    # ----- Doubling flow -----
    def _advance_doubling(self, simulator: Simulator):
        acted = self.state.get("doubling_acted")
        if all(acted.values()):
            # Enter playing phase; landlord leads
            name = self.state.get("landlord")
            self.state["phase"] = "playing"
            self.state["current_turn"] = self.state.get("players").index(name)
            self.state["leading_combo"] = None
            self.state["passes_since_play"] = 0
            simulator.broadcast(PublicEvent("Doubling finished. Game starts."))
            return

    # ----- Serialization hooks -----
    def serialize_config(self) -> dict:
        return {"num_decks": int(getattr(self, "num_decks", 1) or 1)}

    @classmethod
    def deserialize_config(cls, config: Dict) -> Dict:
        return {"num_decks": int(config.get("num_decks", 1) or 1)}
