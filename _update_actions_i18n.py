"""One-shot script to add prompts.actions.* keys to en.json and zh.json."""
import json
from pathlib import Path

EN = Path("src/socialsim4/locales/en.json")
ZH = Path("src/socialsim4/locales/zh.json")

# ── English translations ──────────────────────────────────────────────
en_actions = {
    "speak": {
        "name": "speak",
        "desc": "Say something.",
        "instruction": "- speak: Broadcast a message\n  <Action name=\"speak\" />\n  (You will be prompted to write your message after selecting this action.)",
        "error_missing_message": "Missing message.",
        "summary_spoke": "{agent_name} said: {message}",
        "summary_failed": "{agent_name} failed to speak"
    },
    "send_message": {
        "name": "send_message",
        "desc": "Post a message to all participants.",
        "instruction": "- send_message: Send to everyone\n  <Action name=\"send_message\" />\n  (You will be prompted to write your message after selecting this action.)",
        "error_missing_message": "Missing message.",
        "summary_sent": "{agent_name}: {message}",
        "summary_failed": "{agent_name} failed to post"
    },
    "yield": {
        "name": "yield",
        "desc": "Yield the floor and end your turn.",
        "instruction": "- yield: End your turn\n  <Action name=\"yield\"/>",
        "summary_yielded": "{agent_name} yielded the floor"
    },
    "talk_to": {
        "name": "talk_to",
        "desc": "Say something to a nearby person by name.",
        "instruction": "- talk_to: Speak to nearby agent\n  <Action name=\"talk_to\"><target>Name</target><message>Hi!</message></Action>",
        "error_missing_params": "Provide 'target' (name) and 'message'.",
        "error_no_such_person": "No such person: {target_name}.",
        "error_too_far": "{target_name} is too far to talk to.",
        "summary_failed": "{agent_name} failed to talk",
        "summary_talked": "{agent_name} to {target_name}: {message}"
    },
    "schedule_order": {
        "name": "schedule_order",
        "desc": "Moderator schedules the next few agents to act using a comma-separated list.",
        "instruction": "- To schedule the next speakers/actors (moderator only):\n  <Action name=\"schedule_order\"><order>Alice, Bob, Charlie</order></Action>",
        "error_schedule_not_empty": "The schedule is not empty; shouldn't schedule now.",
        "summary_failed": "schedule_order failed: schedule not empty",
        "feedback_scheduled": "Scheduled order: {names}",
        "summary_scheduled": "{agent_name} scheduled: {names}"
    },
    "start_voting": {
        "name": "start_voting",
        "desc": "Initiate a voting round with a title. Any agent can propose when in discussion phase.",
        "instruction": "- To start voting with a title:\n<Action name=\"start_voting\"><title>[short subject]</title></Action>",
        "state_error": "Cannot start voting: a vote is already in progress",
        "event_voting_started": "{agent_name} has initiated the voting round: {title}. Please cast your votes now.",
        "feedback_voting_started": "Voting started: {title}",
        "summary_voting_started": "{agent_name} started the voting: {title}"
    },
    "voting_status": {
        "name": "voting_status",
        "desc": "Show current voting progress: counts and pending voters.",
        "instruction": "- To check voting status:\n<Action name=\"voting_status\" />",
        "feedback_not_started": "Voting has not started.",
        "summary_not_started": "Voting not started",
        "feedback_status_header": "Voting status on: {title}:",
        "feedback_participants": "- Participants: {count}",
        "feedback_tally": "- Yes: {yes}, No: {no}, Abstain: {abstain}",
        "feedback_pending": "- Pending: {pending} ({names})",
        "feedback_pending_no_names": "- Pending: {pending}",
        "summary_status": "Voting status on '{title}': yes {yes}, no {no}, abstain {abstain}, pending {pending}"
    },
    "request_brief": {
        "name": "request_brief",
        "desc": "Fetch a concise, neutral brief via LLM when debate stalls, facts are missing, or members request data; provide a clear 'desc' (topic + focus). Any agent can request.",
        "instruction": "\n- To request a brief (any agent):\n<Action name=\"request_brief\"><desc>[topic + focus]</desc></Action>",
        "llm_system_prompt": "You are a policy analyst assisting a legislative council debate. Generate a neutral, factual, concise briefing to unblock discussion. Output plain text only (no JSON, no role tags).",
        "llm_user_prompt": "Provide 5\u20137 crisp bullets with concrete facts, examples, or precedents. Include numbers if helpful and clearly label estimates. Keep under ~180 words.\nNeed: {desc}",
        "fallback_item_scope": "- Scope: {desc}",
        "fallback_item_fact": "- Key fact/definition",
        "fallback_item_example": "- Comparable example (outcome)",
        "fallback_item_stakeholders": "- Stakeholders: who benefits / pays",
        "fallback_item_cost": "- Rough cost or impact (estimate)",
        "fallback_item_risk": "- Top risk and mitigation",
        "fallback_item_question": "- Open question for the chamber",
        "feedback_brief": "Brief (private) on '{desc}':\n{material}",
        "summary_requested": "{agent_name} requested a brief: {desc}"
    },
    "vote": {
        "name": "vote",
        "desc": "Cast a vote with optional comment. Available during voting phase.",
        "instruction": "- To vote (only after voting has started):\n<Action name=\"vote\"><vote>yes|no|abstain</vote><comment>[optional]</comment></Action>",
        "state_error": "Cannot vote: voting has not started yet",
        "error_already_voted": "You have already voted.",
        "summary_vote_failed": "{agent_name} vote failed",
        "message_vote": "I vote {vote} on '{title}'.",
        "message_vote_with_comment": "I vote {vote} on '{title}'. Comment: {comment}",
        "summary_voted": "{agent_name} voted {vote}",
        "event_concluded_passed": "Voting on '{title}' has concluded. It passed with {yes} yes, {no} no, and {abstain} abstain.",
        "event_concluded_failed": "Voting on '{title}' has concluded. It failed with {yes} yes, {no} no, and {abstain} abstain."
    },
    "finish_meeting": {
        "name": "finish_meeting",
        "desc": "Conclude the council meeting and end the scene. Any agent can propose when no vote is active.",
        "instruction": "- To finish the council meeting (when voting is not in progress):\n<Action name=\"finish_meeting\" />",
        "state_error": "Cannot finish meeting: voting is still in progress",
        "event_adjourned": "{agent_name} has moved to adjourn the council. The session is concluded.",
        "feedback_finished": "Meeting finished.",
        "summary_finished": "{agent_name} finished the meeting"
    },
    "call_landlord": {
        "name": "call_landlord",
        "desc": "During bidding (call stage), call the landlord.",
        "instruction": "\n- To call the landlord (bidding):\n<Action name=\"call_landlord\" />",
        "error_wrong_stage": "You can only call during the call stage.",
        "event_called": "{agent_name} called the landlord.",
        "summary_failed": "{agent_name} call_landlord failed",
        "summary_called": "{agent_name} called landlord"
    },
    "rob_landlord": {
        "name": "rob_landlord",
        "desc": "During bidding (rob stage), rob the landlord. Doubles score multiplier.",
        "instruction": "\n- To rob the landlord (after someone has called):\n<Action name=\"rob_landlord\" />",
        "error_wrong_stage": "You can only rob during the rob stage.",
        "error_already_acted": "You already acted in rob stage.",
        "event_robbed": "{agent_name} robbed the landlord. Multiplier x2.",
        "summary_failed": "{agent_name} rob_landlord failed",
        "summary_robbed": "{agent_name} robbed landlord"
    },
    "pass": {
        "name": "pass",
        "desc": "Pass in the current context (bidding: no-call/no-rob; playing: skip).",
        "instruction": "\n- To pass (bidding: decline; playing: skip):\n<Action name=\"pass\" />",
        "error_bad_stage": "Unknown bidding stage.",
        "error_cannot_pass_lead": "You must lead; cannot pass.",
        "error_bad_phase": "You cannot pass right now.",
        "error_already_acted_rob": "You already acted in rob stage.",
        "event_no_call": "{agent_name} did not call.",
        "event_no_rob": "{agent_name} did not rob.",
        "event_passed": "{agent_name} passed.",
        "summary_pass_call": "{agent_name} passed call",
        "summary_pass_rob": "{agent_name} passed rob",
        "summary_pass_playing": "{agent_name} passed",
        "summary_pass_failed": "{agent_name} pass failed"
    },
    "play_cards": {
        "name": "play_cards",
        "desc": "Play cards (strict tokens). Must beat current leading combo unless leading.",
        "instruction": "\n- To play cards (tokens separated by single spaces):\n<Action name=\"play_cards\"><cards>3 3 3</cards></Action>\nAvailable tokens: 3 4 5 6 7 8 9 10 J Q K A 2 SJ BJ",
        "error_wrong_phase": "You can only play during the playing phase.",
        "error_missing_cards": "Provide cards to play.",
        "error_not_in_hand": "You don't have those cards.",
        "error_invalid_combo": "Invalid combination.",
        "error_not_beating": "Your play does not beat the current lead.",
        "event_played": "{agent_name} played: {cards_str} ({combo_type}).",
        "summary_wrong_phase": "{agent_name} tried: {attempt_str} -> wrong_phase | remaining: {remaining_str}",
        "summary_missing_cards": "{agent_name} tried: (none) -> missing_cards | remaining: {remaining_str}",
        "summary_not_in_hand": "{agent_name} tried: {attempt_str} -> not_in_hand | remaining: {remaining_str}",
        "summary_invalid_combo": "{agent_name} tried: {attempt_str} -> invalid_combo | remaining: {remaining_str}",
        "summary_not_beating": "{agent_name} tried: {attempt_str} -> not_beating | remaining: {remaining_str}",
        "summary_played": "{agent_name} played: {attempt_str} ({combo_type}), remaining: {remaining_str}",
        "summary_won": "{agent_name} played: {attempt_str} ({combo_type}), remaining: {remaining_str} [WIN]"
    },
    "double": {
        "name": "double",
        "desc": "During doubling stage, choose to double and multiply the global multiplier by 2.",
        "instruction": "\n- To double during the doubling stage:\n<Action name=\"double\" />",
        "error_wrong_phase": "You can only double during the doubling stage.",
        "error_already_acted": "You already acted in doubling stage.",
        "event_doubled": "{agent_name} doubled. Multiplier x2.",
        "summary_failed": "{agent_name} double failed",
        "summary_doubled": "{agent_name} doubled"
    },
    "no_double": {
        "name": "no_double",
        "desc": "During doubling stage, explicitly decline doubling.",
        "instruction": "\n- To decline doubling during the doubling stage:\n<Action name=\"no_double\" />",
        "error_wrong_phase": "You can only act during the doubling stage.",
        "error_already_acted": "You already acted in doubling stage.",
        "event_declined": "{agent_name} declined to double.",
        "summary_failed": "{agent_name} no_double failed",
        "summary_declined": "{agent_name} declined doubling"
    },
    "report_upward": {
        "name": "report_upward",
        "desc": "Privately report execution difficulty to a direct superior.",
        "instruction": "- report_upward: Report execution difficulty to a direct superior\n  <Action name=\"report_upward\"><target>Name</target><message>Your difficulty report</message></Action>"
    },
    "escalate_complaint": {
        "name": "escalate_complaint",
        "desc": "Escalate a complaint or risk report to a higher-level superior.",
        "instruction": "- escalate_complaint: Escalate a complaint to a higher-level superior\n  <Action name=\"escalate_complaint\"><target>Name</target><message>Your escalation report</message></Action>"
    },
    "consult_peer": {
        "name": "consult_peer",
        "desc": "Privately consult or coordinate with a connected peer on the same tier.",
        "instruction": "- consult_peer: Privately consult a connected peer on the same tier\n  <Action name=\"consult_peer\"><target>Name</target><message>Your consultation message</message></Action>"
    },
    "notify_subordinate": {
        "name": "notify_subordinate",
        "desc": "Privately notify a directly connected subordinate.",
        "instruction": "- notify_subordinate: Privately notify a directly connected subordinate\n  <Action name=\"notify_subordinate\"><target>Name</target><message>Your notification</message></Action>"
    },
    "announce_policy_adjustment": {
        "name": "announce_policy_adjustment",
        "desc": "Issue a new policy adjustment announcement that reopens cascade transmission.",
        "instruction": "- announce_policy_adjustment: Issue a policy adjustment announcement\n  <Action name=\"announce_policy_adjustment\"><message>Your adjustment announcement</message></Action>"
    },
    "query_knowledge": {
        "name": "query_knowledge",
        "desc": "Query your knowledge base for relevant information on a topic.",
        "instruction": "- To query your knowledge base:\n<Action name=\"query_knowledge\"><query>[your search query]</query><max_results>3</max_results></Action>",
        "error_no_query": "query_knowledge: no query provided.",
        "error_no_query_summary": "{agent_name} query_knowledge failed: no query",
        "feedback_empty_kb": "Knowledge base query for '{query}': No knowledge items in your knowledge base.",
        "summary_empty_kb": "{agent_name} queried knowledge base (empty)",
        "feedback_no_matches": "Knowledge base query for '{query}': No matching results found.",
        "summary_no_matches": "{agent_name} queried knowledge base (no matches)",
        "feedback_results_header": "Knowledge base results for '{query}':",
        "feedback_results_item": "[{i}] {title}: {content}",
        "summary_success": "{agent_name} queried knowledge base: '{query}' ({count} results)"
    },
    "list_knowledge": {
        "name": "list_knowledge",
        "desc": "List all items in your knowledge base.",
        "instruction": "- To list all knowledge base items:\n<Action name=\"list_knowledge\" />",
        "feedback_empty": "Your knowledge base is empty.",
        "summary_empty": "{agent_name} listed knowledge base (empty)",
        "feedback_list_header": "Your knowledge base ({count} items):",
        "feedback_list_item": "[{i}] ({kb_type}) {title}: {content_preview}",
        "summary_success": "{agent_name} listed knowledge base ({count} items)",
        "item_untitled": "Untitled"
    },
    "web_search": {
        "name": "web_search",
        "desc": "Search the web and return top results (title, URL, snippet). Use this action to find up-to-date information with a concrete query.",
        "instruction": "- To search the web for information:\n<Action name=\"web_search\"><query>[keywords or question]</query><max_results>5</max_results></Action>",
        "error_no_results": "web_search: no results or network unavailable.",
        "summary_failed": "{agent_name} web_search failed",
        "feedback_results_header": "Web search results for '{query}':",
        "summary_success": "{agent_name} searched: '{query}' ({count} results)"
    },
    "view_page": {
        "name": "view_page",
        "desc": "Fetch and preview the text content of a web page.",
        "instruction": "- To view a web page's text content:\n<Action name=\"view_page\"><url>https://example.com/article</url><max_chars>4000</max_chars></Action>",
        "error_http": "view_page HTTP error: {error}",
        "error_general": "view_page failed: {error}",
        "summary_failed": "{agent_name} view_page failed",
        "feedback_header_with_title": "Page content preview: {title}",
        "feedback_header_no_title": "Page content preview:",
        "feedback_body": "{header}\nURL: {url}\n\n{text}",
        "summary_success": "{agent_name} viewed page: {title_or_url}"
    },
    "vote_lynch": {
        "name": "vote_lynch",
        "desc": "During the day, vote to lynch a player. One vote per day.",
        "instruction": "- To vote to lynch someone during the day:\n<Action name=\"vote_lynch\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "You can only vote during the voting phase.",
        "error_dead": "You are dead and cannot act.",
        "error_invalid_target": "Provide a living 'target' to vote.",
        "event_vote_cast": "{agent_name} voted to lynch {target}.",
        "summary_vote_cast": "{agent_name} voted to lynch {target}",
        "summary_failed": "{agent_name} failed to vote: {action_data}"
    },
    "night_kill": {
        "name": "night_kill",
        "desc": "At night, werewolves vote on a victim to kill.",
        "instruction": "- Werewolves: to vote a night kill target (at night only):\n<Action name=\"night_kill\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "Night kill can only be cast at night.",
        "error_not_werewolf_or_dead": "Only living werewolves can vote a night kill.",
        "error_first_night": "First night has no kills; discuss with fellow wolves.",
        "error_invalid_target": "Provide a living non-werewolf 'target'.",
        "event_vote_cast": "{agent_name} voted night kill to {target}.",
        "summary_vote_cast": "{agent_name} voted night kill: {target}",
        "summary_failed": "{agent_name} night_kill failed"
    },
    "inspect": {
        "name": "inspect",
        "desc": "At night, seer inspects a player and learns if they are a werewolf.",
        "instruction": "- Seer: to inspect a player at night:\n<Action name=\"inspect\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "You can only inspect at night.",
        "error_not_seer_or_dead": "Only a living Seer can inspect.",
        "error_invalid_target": "Provide a living 'target' to inspect.",
        "result_werewolf": "a werewolf",
        "result_not_werewolf": "not a werewolf",
        "feedback_result": "Inspection result: {target} is {result}.",
        "event_inspected_werewolf": "{agent_name} inspected {target} (werewolf)",
        "event_inspected_not_werewolf": "{agent_name} inspected {target} (not)",
        "summary_inspected_werewolf": "{agent_name} inspected {target} (werewolf)",
        "summary_inspected_not_werewolf": "{agent_name} inspected {target} (not)",
        "summary_failed": "{agent_name} inspect failed"
    },
    "witch_save": {
        "name": "witch_save",
        "desc": "At night, witch may save the intended victim once per game.",
        "instruction": "- Witch: to save tonight's victim (once per game):\n<Action name=\"witch_save\" />",
        "error_wrong_phase": "You can only use save at night.",
        "error_not_witch_or_dead": "Only a living Witch can save.",
        "error_no_heal_left": "You have already used your save potion.",
        "feedback_save_prepared": "You prepare the save potion for tonight's victim.",
        "event_save_prepared": "{agent_name} prepared a save potion.",
        "summary_used": "{agent_name} used witch save",
        "summary_failed": "{agent_name} witch_save failed"
    },
    "witch_poison": {
        "name": "witch_poison",
        "desc": "At night, witch may poison one player once per game.",
        "instruction": "- Witch: to poison a player at night (once per game):\n<Action name=\"witch_poison\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "You can only poison at night.",
        "error_not_witch_or_dead": "Only a living Witch can poison.",
        "error_invalid_target": "Provide a living 'target' other than yourself.",
        "error_no_poison_left": "You have already used your poison potion.",
        "feedback_poison_prepared": "You prepared a poison targeting {target}.",
        "event_poison_prepared": "{agent_name} prepared a poison targeting {target}.",
        "summary_prepared": "{agent_name} prepared poison for {target}",
        "summary_failed": "{agent_name} witch_poison failed"
    },
    "open_voting": {
        "name": "open_voting",
        "desc": "Moderator should use this action to open voting after discussion.",
        "instruction": "- Moderator: open voting after discussion:\n<Action name=\"open_voting\" />",
        "error_not_moderator": "Only the moderator can open voting.",
        "error_wrong_phase": "Open voting only during discussion phase.",
        "event_voting_open": "Voting is now open.",
        "summary_opened": "{agent_name} opened voting",
        "summary_failed": "{agent_name} open_voting failed"
    },
    "close_voting": {
        "name": "close_voting",
        "desc": "Moderator closes voting, resolves lynch, ends the day.",
        "instruction": "- Moderator: close voting and end the day:\n<Action name=\"close_voting\" />",
        "error_not_moderator": "Only the moderator can close voting.",
        "error_wrong_phase": "Close voting only during voting phase.",
        "event_game_over": "Game over: {winner} win.",
        "summary_closed": "{agent_name} closed voting",
        "summary_failed": "{agent_name} close_voting failed"
    },
    "move_to_location": {
        "name": "move_to_location",
        "desc": "Move to a named location or coordinates.",
        "instruction": "- move_to_location: Go to a place\n  <Action name=\"move_to_location\"><location>market</location></Action>\n  Or: <Action name=\"move_to_location\"><x>10</x><y>10</y></Action>"
    },
    "look_around": {
        "name": "look_around",
        "desc": "Survey nearby tiles, locations, and agents.",
        "instruction": "- look_around: See who and what is nearby\n  <Action name=\"look_around\"/>"
    },
    "gather_resource": {
        "name": "gather_resource",
        "desc": "Collect a resource at current tile/location.",
        "instruction": "- gather_resource: Collect food, wood, or water\n  <Action name=\"gather_resource\"><resource>food</resource></Action>"
    },
    "rest": {
        "name": "rest",
        "desc": "Recover energy; more in buildings.",
        "instruction": "- rest: Recover energy\n  <Action name=\"rest\"/>"
    }
}

# ── Chinese translations ──────────────────────────────────────────────
zh_actions = {
    "speak": {
        "name": "speak",
        "desc": "说话。",
        "instruction": "- speak: 广播一条消息\n  <Action name=\"speak\" />\n  （选择此操作后，您将被提示输入消息内容。）",
        "error_missing_message": "缺少消息内容。",
        "summary_spoke": "{agent_name} 说道：{message}",
        "summary_failed": "{agent_name} 说话失败"
    },
    "send_message": {
        "name": "send_message",
        "desc": "向所有参与者发送消息。",
        "instruction": "- send_message: 发送给所有人\n  <Action name=\"send_message\" />\n  （选择此操作后，您将被提示输入消息内容。）",
        "error_missing_message": "缺少消息内容。",
        "summary_sent": "{agent_name}：{message}",
        "summary_failed": "{agent_name} 发送消息失败"
    },
    "yield": {
        "name": "yield",
        "desc": "让出发言权并结束你的回合。",
        "instruction": "- yield: 结束你的回合\n  <Action name=\"yield\"/>",
        "summary_yielded": "{agent_name} 让出了发言权"
    },
    "talk_to": {
        "name": "talk_to",
        "desc": "按名字向附近的人说话。",
        "instruction": "- talk_to: 与附近的智能体交谈\n  <Action name=\"talk_to\"><target>名字</target><message>你好！</message></Action>",
        "error_missing_params": "请提供 'target'（名字）和 'message'（消息）。",
        "error_no_such_person": "没有此人：{target_name}。",
        "error_too_far": "{target_name} 距离太远，无法交谈。",
        "summary_failed": "{agent_name} 交谈失败",
        "summary_talked": "{agent_name} 对 {target_name} 说：{message}"
    },
    "schedule_order": {
        "name": "schedule_order",
        "desc": "主持人使用逗号分隔的列表安排接下来的几个智能体行动。",
        "instruction": "- 安排接下来的发言者/行动者（仅限主持人）：\n  <Action name=\"schedule_order\"><order>Alice, Bob, Charlie</order></Action>",
        "error_schedule_not_empty": "日程不为空；现在不应该进行安排。",
        "summary_failed": "schedule_order 失败：日程不为空",
        "feedback_scheduled": "已安排顺序：{names}",
        "summary_scheduled": "{agent_name} 已安排：{names}"
    },
    "start_voting": {
        "name": "start_voting",
        "desc": "发起带标题的投票轮次。在讨论阶段，任何代理人都可以提出投票。",
        "instruction": "- 要发起带标题的投票：\n<Action name=\"start_voting\"><title>[简短主题]</title></Action>",
        "state_error": "无法发起投票：当前已有投票正在进行",
        "event_voting_started": "{agent_name} 已发起投票轮次：{title}。请现在开始投票。",
        "feedback_voting_started": "投票已开始：{title}",
        "summary_voting_started": "{agent_name} 发起了投票：{title}"
    },
    "voting_status": {
        "name": "voting_status",
        "desc": "显示当前投票进展：票数统计和未投票成员。",
        "instruction": "- 要查看投票状态：\n<Action name=\"voting_status\" />",
        "feedback_not_started": "投票尚未开始。",
        "summary_not_started": "投票尚未开始",
        "feedback_status_header": "投票状态——{title}：",
        "feedback_participants": "- 参与人数：{count}",
        "feedback_tally": "- 赞成：{yes}，反对：{no}，弃权：{abstain}",
        "feedback_pending": "- 待投票：{pending}（{names}）",
        "feedback_pending_no_names": "- 待投票：{pending}",
        "summary_status": "'{title}' 的投票状态：赞成 {yes}，反对 {no}，弃权 {abstain}，待投票 {pending}"
    },
    "request_brief": {
        "name": "request_brief",
        "desc": "当辩论陷入僵局、事实缺失或成员请求数据时，通过LLM获取简明中立的简报；请提供清晰的'desc'（主题+焦点）。任何代理人都可以请求。",
        "instruction": "\n- 要请求简报（任何代理人）：\n<Action name=\"request_brief\"><desc>[主题+焦点]</desc></Action>",
        "llm_system_prompt": "你是一位政策分析师，协助立法委员会辩论。生成一份中立、基于事实的简明简报以推动讨论。仅输出纯文本（不使用JSON或角色标签）。",
        "llm_user_prompt": "提供5-7条简洁要点，包含具体事实、案例或先例。如有帮助请包含数据，并明确标注估计值。控制在180词以内。\n需求：{desc}",
        "fallback_item_scope": "- 范围：{desc}",
        "fallback_item_fact": "- 关键事实/定义",
        "fallback_item_example": "- 可比案例（结果）",
        "fallback_item_stakeholders": "- 利益相关方：谁受益/谁承担成本",
        "fallback_item_cost": "- 大致成本或影响（估计值）",
        "fallback_item_risk": "- 主要风险及缓解措施",
        "fallback_item_question": "- 供议院讨论的开放性问题",
        "feedback_brief": "关于 '{desc}' 的简报（私有）：\n{material}",
        "summary_requested": "{agent_name} 请求了一份简报：{desc}"
    },
    "vote": {
        "name": "vote",
        "desc": "投票，可附加评论。在投票阶段可用。",
        "instruction": "- 要投票（仅在投票开始后）：\n<Action name=\"vote\"><vote>yes|no|abstain</vote><comment>[可选]</comment></Action>",
        "state_error": "无法投票：投票尚未开始",
        "error_already_voted": "你已经投过票了。",
        "summary_vote_failed": "{agent_name} 投票失败",
        "message_vote": "我对 '{title}' 投 {vote} 票。",
        "message_vote_with_comment": "我对 '{title}' 投 {vote} 票。评论：{comment}",
        "summary_voted": "{agent_name} 投了 {vote} 票",
        "event_concluded_passed": "'{title}' 的投票已结束。以 {yes} 票赞成、{no} 票反对、{abstain} 票弃权获得通过。",
        "event_concluded_failed": "'{title}' 的投票已结束。以 {yes} 票赞成、{no} 票反对、{abstain} 票弃权未获通过。"
    },
    "finish_meeting": {
        "name": "finish_meeting",
        "desc": "结束委员会会议并终止场景。在没有投票进行时，任何代理人都可以提出。",
        "instruction": "- 要结束委员会会议（投票未进行时）：\n<Action name=\"finish_meeting\" />",
        "state_error": "无法结束会议：投票仍在进行中",
        "event_adjourned": "{agent_name} 提出散会动议。本次会议到此结束。",
        "feedback_finished": "会议已结束。",
        "summary_finished": "{agent_name} 结束了会议"
    },
    "call_landlord": {
        "name": "call_landlord",
        "desc": "在叫牌阶段（叫地主阶段），叫地主。",
        "instruction": "\n- 叫地主（叫牌）：\n<Action name=\"call_landlord\" />",
        "error_wrong_stage": "你只能在叫地主阶段叫地主。",
        "event_called": "{agent_name} 叫了地主。",
        "summary_failed": "{agent_name} 叫地主失败",
        "summary_called": "{agent_name} 叫了地主"
    },
    "rob_landlord": {
        "name": "rob_landlord",
        "desc": "在叫牌阶段（抢地主阶段），抢地主。积分翻倍。",
        "instruction": "\n- 抢地主（有人叫地主之后）：\n<Action name=\"rob_landlord\" />",
        "error_wrong_stage": "你只能在抢地主阶段抢地主。",
        "error_already_acted": "你已经在抢地主阶段行动过了。",
        "event_robbed": "{agent_name} 抢了地主。积分翻倍。",
        "summary_failed": "{agent_name} 抢地主失败",
        "summary_robbed": "{agent_name} 抢了地主"
    },
    "pass": {
        "name": "pass",
        "desc": "在当前情境下过牌（叫牌阶段：不叫/不抢；出牌阶段：跳过）。",
        "instruction": "\n- 过牌（叫牌阶段：放弃；出牌阶段：跳过）：\n<Action name=\"pass\" />",
        "error_bad_stage": "未知的叫牌阶段。",
        "error_cannot_pass_lead": "你必须先出牌，不能过牌。",
        "error_bad_phase": "现在不能过牌。",
        "error_already_acted_rob": "你已经在抢地主阶段行动过了。",
        "event_no_call": "{agent_name} 没有叫地主。",
        "event_no_rob": "{agent_name} 没有抢地主。",
        "event_passed": "{agent_name} 过牌。",
        "summary_pass_call": "{agent_name} 没有叫地主",
        "summary_pass_rob": "{agent_name} 没有抢地主",
        "summary_pass_playing": "{agent_name} 过牌",
        "summary_pass_failed": "{agent_name} 过牌失败"
    },
    "play_cards": {
        "name": "play_cards",
        "desc": "出牌（严格牌面）。必须大过当前领出牌型，除非是你领出。",
        "instruction": "\n- 出牌（牌面之间用空格分隔）：\n<Action name=\"play_cards\"><cards>3 3 3</cards></Action>\n可用牌面：3 4 5 6 7 8 9 10 J Q K A 2 SJ BJ",
        "error_wrong_phase": "你只能在出牌阶段出牌。",
        "error_missing_cards": "请提供要出的牌。",
        "error_not_in_hand": "你没有这些牌。",
        "error_invalid_combo": "无效的牌型组合。",
        "error_not_beating": "你的出牌大不过当前领出的牌。",
        "event_played": "{agent_name} 出牌：{cards_str}（{combo_type}）。",
        "summary_wrong_phase": "{agent_name} 尝试：{attempt_str} -> 阶段错误 | 剩余：{remaining_str}",
        "summary_missing_cards": "{agent_name} 尝试：（无）-> 缺少牌 | 剩余：{remaining_str}",
        "summary_not_in_hand": "{agent_name} 尝试：{attempt_str} -> 手中无此牌 | 剩余：{remaining_str}",
        "summary_invalid_combo": "{agent_name} 尝试：{attempt_str} -> 无效牌型 | 剩余：{remaining_str}",
        "summary_not_beating": "{agent_name} 尝试：{attempt_str} -> 管不上 | 剩余：{remaining_str}",
        "summary_played": "{agent_name} 出牌：{attempt_str}（{combo_type}），剩余：{remaining_str}",
        "summary_won": "{agent_name} 出牌：{attempt_str}（{combo_type}），剩余：{remaining_str} [胜利]"
    },
    "double": {
        "name": "double",
        "desc": "在加倍阶段，选择加倍，将全局积分倍数乘以2。",
        "instruction": "\n- 在加倍阶段选择加倍：\n<Action name=\"double\" />",
        "error_wrong_phase": "你只能在加倍阶段加倍。",
        "error_already_acted": "你已经在加倍阶段行动过了。",
        "event_doubled": "{agent_name} 加倍了。积分翻倍。",
        "summary_failed": "{agent_name} 加倍失败",
        "summary_doubled": "{agent_name} 加倍了"
    },
    "no_double": {
        "name": "no_double",
        "desc": "在加倍阶段，明确拒绝加倍。",
        "instruction": "\n- 在加倍阶段拒绝加倍：\n<Action name=\"no_double\" />",
        "error_wrong_phase": "你只能在加倍阶段操作。",
        "error_already_acted": "你已经在加倍阶段行动过了。",
        "event_declined": "{agent_name} 拒绝加倍。",
        "summary_failed": "{agent_name} 拒绝加倍失败",
        "summary_declined": "{agent_name} 拒绝加倍"
    },
    "report_upward": {
        "name": "report_upward",
        "desc": "私下向直属上级报告执行困难。",
        "instruction": "- report_upward: 向直属上级报告执行困难\n  <Action name=\"report_upward\"><target>姓名</target><message>您的困难报告</message></Action>"
    },
    "escalate_complaint": {
        "name": "escalate_complaint",
        "desc": "将投诉或风险报告上报给更高级别的上级。",
        "instruction": "- escalate_complaint: 向更高级别的上级上报投诉\n  <Action name=\"escalate_complaint\"><target>姓名</target><message>您的上报报告</message></Action>"
    },
    "consult_peer": {
        "name": "consult_peer",
        "desc": "私下咨询或与同级别的关联同事协调。",
        "instruction": "- consult_peer: 私下咨询同级别的关联同事\n  <Action name=\"consult_peer\"><target>姓名</target><message>您的咨询消息</message></Action>"
    },
    "notify_subordinate": {
        "name": "notify_subordinate",
        "desc": "私下通知直属下级。",
        "instruction": "- notify_subordinate: 私下通知直属下级\n  <Action name=\"notify_subordinate\"><target>姓名</target><message>您的通知内容</message></Action>"
    },
    "announce_policy_adjustment": {
        "name": "announce_policy_adjustment",
        "desc": "发布新的政策调整公告，重新开启级联传播。",
        "instruction": "- announce_policy_adjustment: 发布政策调整公告\n  <Action name=\"announce_policy_adjustment\"><message>您的调整公告</message></Action>"
    },
    "query_knowledge": {
        "name": "query_knowledge",
        "desc": "查询您的知识库以获取有关某主题的相关信息。",
        "instruction": "- 查询您的知识库：\n<Action name=\"query_knowledge\"><query>[您的搜索查询]</query><max_results>3</max_results></Action>",
        "error_no_query": "query_knowledge: 未提供查询内容。",
        "error_no_query_summary": "{agent_name} query_knowledge 失败：无查询内容",
        "feedback_empty_kb": "知识库查询 '{query}'：您的知识库中没有知识条目。",
        "summary_empty_kb": "{agent_name} 查询了知识库（为空）",
        "feedback_no_matches": "知识库查询 '{query}'：未找到匹配结果。",
        "summary_no_matches": "{agent_name} 查询了知识库（无匹配结果）",
        "feedback_results_header": "知识库查询 '{query}' 的结果：",
        "feedback_results_item": "[{i}] {title}: {content}",
        "summary_success": "{agent_name} 查询了知识库：'{query}'（{count} 条结果）"
    },
    "list_knowledge": {
        "name": "list_knowledge",
        "desc": "列出您知识库中的所有条目。",
        "instruction": "- 列出所有知识库条目：\n<Action name=\"list_knowledge\" />",
        "feedback_empty": "您的知识库为空。",
        "summary_empty": "{agent_name} 列出了知识库（为空）",
        "feedback_list_header": "您的知识库（{count} 条）：",
        "feedback_list_item": "[{i}] ({kb_type}) {title}: {content_preview}",
        "summary_success": "{agent_name} 列出了知识库（{count} 条）",
        "item_untitled": "无标题"
    },
    "web_search": {
        "name": "web_search",
        "desc": "搜索网络并返回最相关的结果（标题、URL、摘要）。使用此操作通过具体查询查找最新信息。",
        "instruction": "- 搜索网络获取信息：\n<Action name=\"web_search\"><query>[关键词或问题]</query><max_results>5</max_results></Action>",
        "error_no_results": "web_search: 无结果或网络不可用。",
        "summary_failed": "{agent_name} web_search 失败",
        "feedback_results_header": "'{query}' 的网络搜索结果：",
        "summary_success": "{agent_name} 搜索了：'{query}'（{count} 条结果）"
    },
    "view_page": {
        "name": "view_page",
        "desc": "获取并预览网页的文本内容。",
        "instruction": "- 查看网页的文本内容：\n<Action name=\"view_page\"><url>https://example.com/article</url><max_chars>4000</max_chars></Action>",
        "error_http": "view_page HTTP 错误：{error}",
        "error_general": "view_page 失败：{error}",
        "summary_failed": "{agent_name} view_page 失败",
        "feedback_header_with_title": "页面内容预览：{title}",
        "feedback_header_no_title": "页面内容预览：",
        "feedback_body": "{header}\nURL: {url}\n\n{text}",
        "summary_success": "{agent_name} 查看了页面：{title_or_url}"
    },
    "vote_lynch": {
        "name": "vote_lynch",
        "desc": "在白天投票放逐一名玩家。每天只能投一票。",
        "instruction": "- 在白天投票放逐某人：\n<Action name=\"vote_lynch\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "你只能在投票阶段进行投票。",
        "error_dead": "你已经死亡，无法行动。",
        "error_invalid_target": "请提供一个存活的投票目标。",
        "event_vote_cast": "{agent_name} 投票放逐 {target}。",
        "summary_vote_cast": "{agent_name} 投票放逐 {target}",
        "summary_failed": "{agent_name} 投票失败：{action_data}"
    },
    "night_kill": {
        "name": "night_kill",
        "desc": "在夜晚，狼人投票选择要击杀的目标。",
        "instruction": "- 狼人：投票选择夜晚击杀目标（仅限夜晚）：\n<Action name=\"night_kill\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "夜晚击杀只能在夜晚进行。",
        "error_not_werewolf_or_dead": "只有存活的狼人才能投票进行夜晚击杀。",
        "error_first_night": "第一夜没有击杀；与同伴狼人讨论吧。",
        "error_invalid_target": "请提供一个存活的非狼人目标。",
        "event_vote_cast": "{agent_name} 投票夜晚击杀 {target}。",
        "summary_vote_cast": "{agent_name} 投票夜晚击杀：{target}",
        "summary_failed": "{agent_name} 夜晚击杀失败"
    },
    "inspect": {
        "name": "inspect",
        "desc": "在夜晚，预言家查验一名玩家是否为狼人。",
        "instruction": "- 预言家：在夜晚查验一名玩家：\n<Action name=\"inspect\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "你只能在夜晚进行查验。",
        "error_not_seer_or_dead": "只有存活的预言家才能查验。",
        "error_invalid_target": "请提供一个存活的查验目标。",
        "result_werewolf": "狼人",
        "result_not_werewolf": "不是狼人",
        "feedback_result": "查验结果：{target} 是 {result}。",
        "event_inspected_werewolf": "{agent_name} 查验了 {target}（狼人）",
        "event_inspected_not_werewolf": "{agent_name} 查验了 {target}（非狼人）",
        "summary_inspected_werewolf": "{agent_name} 查验了 {target}（狼人）",
        "summary_inspected_not_werewolf": "{agent_name} 查验了 {target}（非狼人）",
        "summary_failed": "{agent_name} 查验失败"
    },
    "witch_save": {
        "name": "witch_save",
        "desc": "在夜晚，女巫可以拯救被选中的受害者，每局游戏只能使用一次。",
        "instruction": "- 女巫：拯救今晚的受害者（每局游戏只能使用一次）：\n<Action name=\"witch_save\" />",
        "error_wrong_phase": "你只能在夜晚使用解药。",
        "error_not_witch_or_dead": "只有存活的女巫才能使用解药。",
        "error_no_heal_left": "你已经用过解药了。",
        "feedback_save_prepared": "你为今晚的受害者准备了解药。",
        "event_save_prepared": "{agent_name} 准备了解药。",
        "summary_used": "{agent_name} 使用了女巫解药",
        "summary_failed": "{agent_name} 女巫解药使用失败"
    },
    "witch_poison": {
        "name": "witch_poison",
        "desc": "在夜晚，女巫可以毒杀一名玩家，每局游戏只能使用一次。",
        "instruction": "- 女巫：在夜晚毒杀一名玩家（每局游戏只能使用一次）：\n<Action name=\"witch_poison\"><target>[player_name]</target></Action>",
        "error_wrong_phase": "你只能在夜晚使用毒药。",
        "error_not_witch_or_dead": "只有存活的女巫才能使用毒药。",
        "error_invalid_target": "请提供一个存活的其他玩家作为目标。",
        "error_no_poison_left": "你已经用过毒药了。",
        "feedback_poison_prepared": "你准备了毒药，目标是 {target}。",
        "event_poison_prepared": "{agent_name} 准备了毒药，目标是 {target}。",
        "summary_prepared": "{agent_name} 为 {target} 准备了毒药",
        "summary_failed": "{agent_name} 女巫毒药使用失败"
    },
    "open_voting": {
        "name": "open_voting",
        "desc": "主持人应在讨论结束后使用此操作开启投票。",
        "instruction": "- 主持人：在讨论结束后开启投票：\n<Action name=\"open_voting\" />",
        "error_not_moderator": "只有主持人才能开启投票。",
        "error_wrong_phase": "只能在讨论阶段开启投票。",
        "event_voting_open": "投票现在开始。",
        "summary_opened": "{agent_name} 开启了投票",
        "summary_failed": "{agent_name} 开启投票失败"
    },
    "close_voting": {
        "name": "close_voting",
        "desc": "主持人关闭投票，结算放逐结果，结束白天。",
        "instruction": "- 主持人：关闭投票并结束白天：\n<Action name=\"close_voting\" />",
        "error_not_moderator": "只有主持人才能关闭投票。",
        "error_wrong_phase": "只能在投票阶段关闭投票。",
        "event_game_over": "游戏结束：{winner} 获胜。",
        "summary_closed": "{agent_name} 关闭了投票",
        "summary_failed": "{agent_name} 关闭投票失败"
    },
    "move_to_location": {
        "name": "move_to_location",
        "desc": "移动到指定地点或坐标。",
        "instruction": "- move_to_location: 前往某个地点\n  <Action name=\"move_to_location\"><location>market</location></Action>\n  或：<Action name=\"move_to_location\"><x>10</x><y>10</y></Action>"
    },
    "look_around": {
        "name": "look_around",
        "desc": "观察附近的区块、地点和其他智能体。",
        "instruction": "- look_around: 查看附近有谁和什么\n  <Action name=\"look_around\"/>"
    },
    "gather_resource": {
        "name": "gather_resource",
        "desc": "在当前区块/地点采集资源。",
        "instruction": "- gather_resource: 采集食物、木材或水源\n  <Action name=\"gather_resource\"><resource>food</resource></Action>"
    },
    "rest": {
        "name": "rest",
        "desc": "恢复能量；在建筑中恢复更多。",
        "instruction": "- rest: 恢复能量\n  <Action name=\"rest\"/>"
    }
}

# ── Merge and write ───────────────────────────────────────────────────
for path, actions_data in [(EN, en_actions), (ZH, zh_actions)]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["prompts"]["actions"] = actions_data
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Updated {path}")

print("Done! Added prompts.actions.* keys to both locale files.")
