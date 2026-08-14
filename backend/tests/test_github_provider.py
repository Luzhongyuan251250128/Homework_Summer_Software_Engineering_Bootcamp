import httpx

from app.providers.github import GitHubProvider, parse_github_time


def fake_response(payload, link=None):
    return httpx.Response(200, json=payload, headers={"Link": link} if link else {})


def test_parse_github_time():
    dt = parse_github_time("2026-01-05T09:30:00Z")
    assert dt.year == 2026 and dt.month == 1 and dt.day == 5
    assert dt.hour == 9 and dt.minute == 30


def test_list_commits_single_page():
    def handler(request):
        return fake_response([
            {"sha": "abc123", "commit": {"author": {"name": "Alice", "email": "a@x.com", "date": "2026-01-05T09:30:00Z"}},
             "stats": {"additions": 10, "deletions": 2}, "files": [{"filename": "f1"}]},
        ])

    provider = GitHubProvider("org/repo", "ghp_fake", client=httpx.Client(transport=httpx.MockTransport(handler)))
    commits = provider.list_commits()
    assert len(commits) == 1
    c = commits[0]
    assert c.sha == "abc123" and c.author_email == "a@x.com"
    assert c.add_lines == 10 and c.del_lines == 2 and c.files_changed == 1


def test_pagination_follows_next_link():
    calls = []

    def handler(request):
        calls.append(request.url)
        if len(calls) == 1:
            return fake_response(
                [{"sha": "s1", "commit": {"author": {"name": "A", "email": "a@x.com", "date": "2026-01-05T09:30:00Z"}},
                  "stats": {}, "files": []}],
                link='<https://api.github.com/repos/org/repo/commits?page=2>; rel="next"',
            )
        return fake_response(
            [{"sha": "s2", "commit": {"author": {"name": "B", "email": "b@x.com", "date": "2026-01-05T10:00:00Z"}},
              "stats": {}, "files": []}],
        )

    provider = GitHubProvider("org/repo", "ghp_fake", client=httpx.Client(transport=httpx.MockTransport(handler)))
    commits = provider.list_commits()
    assert [c.sha for c in commits] == ["s1", "s2"]
