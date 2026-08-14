from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CommitInfo:
    sha: str
    author_name: str
    author_email: str
    committed_at: str  # ISO 8601，如 2026-01-05T09:30:00Z
    add_lines: int
    del_lines: int
    files_changed: int


class GitProvider(ABC):
    @abstractmethod
    def list_commits(self, since: str | None = None) -> list[CommitInfo]:
        """返回 since（ISO 8601，含）之后的 commit；分页由实现内部处理"""
