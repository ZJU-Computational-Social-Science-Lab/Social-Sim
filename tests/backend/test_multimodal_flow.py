from socialsim4.core.agent import Agent
from socialsim4.core.event import PublicEvent
from socialsim4.core.ordering import SequentialOrdering
from socialsim4.core.simulator import Simulator


class _DummyScene:
    def __init__(self):
        self.state = {"time": 0}
        self.initial_event = PublicEvent(
            "Initial broadcast",
            images=["https://example.com/a.png"],
            audio=["https://example.com/a.mp3"],
            video=["https://example.com/a.mp4"],
        )

    def initialize_agent(self, agent):
        return None

    def get_scene_actions(self, agent):
        return []

    def pre_run(self, sim):
        return None

    def post_turn(self, agent, simulator):
        return None

    def should_skip_turn(self, agent, simulator):
        return False

    def is_complete(self):
        return False


def test_initial_event_media_is_logged_and_injected():
    events = []

    def handler(event_type: str, data: dict):
        events.append((event_type, data))

    scene = _DummyScene()
    agents = [Agent("Alice", "", ""), Agent("Bob", "", "")]
    sim = Simulator(
        agents,
        scene,
        clients={},
        ordering=SequentialOrdering(),
        event_handler=handler,
        max_steps_per_turn=1,
        broadcast_initial=True,
    )

    # Flush queued events so log handler receives them
    sim.emit_remaining_events()

    # system_broadcast should carry media payload
    broadcast_payloads = [data for et, data in events if et == "system_broadcast"]
    assert broadcast_payloads, "Expected broadcast events"
    payload = broadcast_payloads[0]
    assert payload["images"] == ["https://example.com/a.png"]
    assert payload["audio"] == ["https://example.com/a.mp3"]
    assert payload["video"] == ["https://example.com/a.mp4"]

    # Non-sender agents should receive env feedback with media preserved
    bob_mem = agents[1].short_memory.get_all()
    assert bob_mem, "Expected Bob to receive initial event feedback"
    assert bob_mem[0].get("images") == ["https://example.com/a.png"]
    assert bob_mem[0].get("audio") == ["https://example.com/a.mp3"]
    assert bob_mem[0].get("video") == ["https://example.com/a.mp4"]
