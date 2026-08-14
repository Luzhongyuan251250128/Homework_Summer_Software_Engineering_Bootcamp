import re
from datetime import datetime, timezone

import httpx

from .base import CommitInfo, GitProvider


def parse_github_time(iso: str) -> datetime:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _next_page_url(link_header: str) -> str | None:
    m = re.search(r'<([^>]+)>\s*;\s*rel="next"', link_header or "")
    return m.group(1) if m else None


class GitHubProvider(GitProvider):
    BASE = "https://api.github.com"

    def __init__(self, repo_path: str, token: str, client: httpx.Client | None = None):
        self.repo_path = repo_path
        self.client = client or httpx.Client(
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            timeout=30.0,
        )

    def list_commits(self, since: str | None = None) -> list[CommitInfo]:
        params: dict = {"per_page": 100}
        if since:
            params["since"] = since
        url = f"{self.BASE}/repos/{self.repo_path}/commits"
        out: list[CommitInfo] = []
        while url:
            resp = self.client.get(url, params=params)
            resp.raise_for_status()  # 401/403/429 透传，由 sync_service 捕获
            for c in resp.json():
                out.append(CommitInfo(
                    sha=c["sha"],
                    author_name=c["commit"]["author"]["name"],
                    author_email=c["commit"]["author"]["email"],
                    committed_at=c["commit"]["author"]["date"],
                    add_lines=c.get("stats", {}).get("additions", 0),
                    del_lines=c.get("stats", {}).get("deletions", 0),
                    files_changed=len(c.get("files", [])),
                ))
            url = _next_page_url(resp.headers.get("Link", ""))
            params = {}
        return out
