class ShortTermMemory:
    def __init__(self):
        self.history = []

    def append(self, role, content):
        # Merge with the last message if the role is the same
        if self.history and self.history[-1]["role"] == role:
            self.history[-1]["content"] += f"\n{content}"
        else:
            self.history.append({"role": role, "content": content})

    def get_all(self):
        return self.history

    def clear(self):
        self.history = []

    def searilize(self, dialect="default"):
        if dialect == "default":
            return [{"role": msg["role"], "content": msg["content"]} for msg in self.history]
        else:
            raise NotImplementedError(f"Unknown dialect: {dialect}")

    def __len__(self):
        return len(self.history)
