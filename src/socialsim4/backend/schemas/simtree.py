from pydantic import BaseModel


class SimulationTreeAdvancePayload(BaseModel):
    parent: int
    turns: int


class SimulationTreeAdvanceFrontierPayload(BaseModel):
    turns: int
    only_max_depth: bool = True


class SimulationTreeAdvanceMultiPayload(BaseModel):
    parent: int
    turns: int
    count: int


class SimulationTreeAdvanceChainPayload(BaseModel):
    parent: int
    turns: int


class SimulationTreeBranchPayload(BaseModel):
    parent: int
    ops: list[dict]
