# tests/backend/test_llm_concurrency_and_retry.py

import time
import threading
from concurrent.futures import TimeoutError as FutTimeout, ThreadPoolExecutor

import pytest

from socialsim4.core.llm import LLMClient
from socialsim4.core.llm_config import LLMConfig
from socialsim4.services.llm_client_pool import LLMClientPool


# ------------------------------------------------------------------------
# 工具：构造一个 mock 配置，不会真正访问外部 API
# ------------------------------------------------------------------------
def make_mock_config() -> LLMConfig:
    """
    生成一个使用 dialect='mock' 的 LLMConfig。

    这样 LLMClient.__init__ 会走 mock 分支，不会调用 OpenAI/Gemini 的远程接口；
    我们在测试里再把 client.client 换成自己的假模型。
    """
    return LLMConfig(
        dialect="mock",
        api_key="",
        model="mock",
        base_url=None,
        temperature=0.1,
        top_p=1.0,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        max_tokens=256,
    )


# ------------------------------------------------------------------------
# 1) 测试：LLMClient 的“重试逻辑”是否真的会在异常时重试
# ------------------------------------------------------------------------
def test_llm_client_retries_on_exception():
    """
    场景：底层模型前几次调用抛异常，之后恢复正常。

    期望：
    - chat() 不会立刻失败，而是按 max_retries 进行重试；
    - 最终返回成功结果；
    - 实际调用次数 == 失败次数 + 1。
    """

    cfg = make_mock_config()
    client = LLMClient(cfg)

    # 调小 timeout / backoff，加快测试速度
    client.timeout_s = 2.0
    client.max_retries = 3
    client.retry_backoff_s = 0.01

    class FlakyModel:
        def __init__(self, fail_times: int = 2):
            self.fail_times = fail_times
            self.calls = 0

        def chat(self, messages):
            self.calls += 1
            if self.calls <= self.fail_times:
                # 模拟 LLM 调用抛错
                raise RuntimeError("transient LLM error")
            return "OK_AFTER_RETRIES"

    flaky = FlakyModel(fail_times=2)
    # 替换掉内部真正的模型
    client.client = flaky

    # 不应该抛异常，应当在若干次失败后成功
    result = client.chat([{"role": "user", "content": "hello"}])

    assert result == "OK_AFTER_RETRIES"
    # 调用次数 = 失败 2 次 + 成功 1 次
    assert flaky.calls == 3


# ------------------------------------------------------------------------
# 2) 测试：LLMClient 的“超时 + 重试”是否真的会起作用
# ------------------------------------------------------------------------
def test_llm_client_timeout_and_retry():
    """
    场景：底层模型每次调用都“超时”（sleep > timeout_s），且一直不成功。

    期望：
    - chat() 不会无限挂死；
    - chat() 在用尽 max_retries+1 次尝试后，抛出 FutTimeout；
    - 底层调用次数 == max_retries + 1。
    """

    cfg = make_mock_config()
    client = LLMClient(cfg)

    client.timeout_s = 0.05  # 很短的超时时间
    client.max_retries = 2
    client.retry_backoff_s = 0.01

    class SlowModel:
        def __init__(self):
            self.calls = 0

        def chat(self, messages):
            self.calls += 1
            # 每次都睡比 timeout_s 更久，强制触发超时
            time.sleep(0.2)
            return "NEVER_REACHED"

    slow = SlowModel()
    client.client = slow

    t0 = time.time()
    with pytest.raises(FutTimeout):
        client.chat([{"role": "user", "content": "hello"}])
    elapsed = time.time() - t0

    # 调用次数应该是 max_retries + 1 次
    assert slow.calls == client.max_retries + 1

    # 整体耗时应当是“超时 + 几次退避”的量级，而不是无限挂住
    # 这里不做非常严格的上界，只要不是特别离谱就行
    assert elapsed < 5.0


# ------------------------------------------------------------------------
# 3) 测试：LLMClient 的单 client 并发限流（BoundedSemaphore）是否生效
# ------------------------------------------------------------------------
def test_llm_client_limits_concurrent_calls():
    """
    场景：大量并发调用 chat()，但我们把 _sem 的并发上限设得很小。

    期望：
    - 底层模型的“同时在执行的调用数”不会超过这个上限；
    - 证明 BoundedSemaphore 确实在限制并行度，从而缓解“单分支把模型打崩”的风险。
    """

    cfg = make_mock_config()
    client = LLMClient(cfg)

    # 调大 timeout，避免因为超时而提前失败；禁用重试以简化逻辑
    client.timeout_s = 5.0
    client.max_retries = 0
    client.retry_backoff_s = 0.0

    # 人为把单 client 的并发上限设得很小，比如 3
    from threading import BoundedSemaphore

    client._sem = BoundedSemaphore(3)

    class BusyModel:
        def __init__(self, delay_s: float = 0.05):
            self.delay_s = delay_s
            self.lock = threading.Lock()
            self.current_active = 0
            self.max_seen = 0

        def chat(self, messages):
            # 进入时 +1，记录当前并发数
            with self.lock:
                self.current_active += 1
                if self.current_active > self.max_seen:
                    self.max_seen = self.current_active

            try:
                # 模拟“在 LLM 那边等待响应”的耗时
                time.sleep(self.delay_s)
                return "OK"
            finally:
                # 退出时 -1
                with self.lock:
                    self.current_active -= 1

    busy = BusyModel(delay_s=0.05)
    client.client = busy

    def worker():
        return client.chat([{"role": "user", "content": "hi"}])

    # 一次性发起很多并发调用
    num_tasks = 20
    with ThreadPoolExecutor(max_workers=num_tasks) as ex:
        list(ex.map(lambda _: worker(), range(num_tasks)))

    # 关键断言：在任何时刻，真正进入模型 chat() 的并发度不会超过 3
    assert busy.max_seen <= 3


# ------------------------------------------------------------------------
# 4) 测试：LLMClientPool 是否真的“每分支一份独立 clients”
# ------------------------------------------------------------------------
def test_llm_client_pool_returns_isolated_clients():
    """
    场景：LLMClientPool 用同一份 base_clients 初始化，
    为两个“分支”分别 acquire() 各自的 clients dict。

    期望：
    - 两次 acquire() 得到的是两个不同的 dict 对象；
    - dict 里的 client 实例也不同（通过 clone 或 copy），互不共享；
    - 修改一个分支的 client 属性，不会影响另一个分支。
    """

    class DummyClient:
        def __init__(self):
            self.state = {}

        def __repr__(self):
            return f"DummyClient(id={id(self)}, state={self.state})"

    base_client = DummyClient()
    base_clients = {"chat": base_client, "default": base_client}

    pool = LLMClientPool(base_clients)

    c1 = pool.acquire(branch_id="branch-1")
    c2 = pool.acquire(branch_id="branch-2")

    # 1) dict 本身不能共用
    assert c1 is not c2

    # 2) 同一个 key 下的 client 应当是“不同对象”
    assert c1["chat"] is not c2["chat"]
    assert c1["default"] is not c2["default"]

    # 3) 修改一个分支的 client，不应影响另一个分支
    c1["chat"].state["foo"] = "bar"

    assert c1["chat"].state.get("foo") == "bar"
    assert c2["chat"].state.get("foo") is None

    # 4) 原始 base_client 也不应被污染
    assert base_client.state == {}


# ------------------------------------------------------------------------
# 5) （可选强化）测试：池本身不会被 acquire() 污染 base_clients
# ------------------------------------------------------------------------
def test_llm_client_pool_does_not_mutate_base_clients():
    """
    再补一层：确保 acquire() 过程中不会误改构造时传入的 base_clients 引用。
    """

    class DummyClient:
        def __init__(self):
            self.flag = False

    base_client = DummyClient()
    base_clients = {"chat": base_client}

    pool = LLMClientPool(base_clients)

    acquired = pool.acquire(branch_id="branch-xyz")
    # 修改 acquire 回来的实例
    acquired["chat"].flag = True

    # 原始 base_client.flag 仍然保持 False，说明 clone 生效
    assert base_client.flag is False
