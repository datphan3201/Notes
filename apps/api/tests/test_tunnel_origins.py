import pytest

from planner.config import Settings, settings


def test_development_tunnel_keeps_local_csrf_and_sets_secure_public_cookie(client, monkeypatch):
    config = settings()
    monkeypatch.setattr(config, "environment", "development")
    monkeypatch.setattr(config, "web_origin", "https://planner.example.ts.net")
    monkeypatch.setattr(config, "development_origins", ["http://localhost:3000"])
    assert client.post("/api/v1/tasks", json={"title": "Local capture"}).status_code == 201
    assert (
        client.post(
            "/api/v1/tasks",
            json={"title": "Foreign origin"},
            headers={"origin": "https://foreign.example"},
        ).status_code
        == 403
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a-long-test-password"},
        headers={"origin": config.web_origin},
    )
    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]


@pytest.mark.parametrize(
    "origin", ["https://*.example.com", "https://user@example.com", "https://example.com/path"]
)
def test_origin_configuration_requires_exact_origins(origin):
    with pytest.raises(ValueError, match="exact HTTP"):
        Settings(_env_file=None, web_origin=origin)


def test_production_refuses_development_origin_exceptions():
    with pytest.raises(ValueError, match="Development origins"):
        Settings(
            _env_file=None,
            environment="production",
            web_origin="https://planner.example.com",
            development_origins=["http://localhost:3000"],
        )


def test_vercel_frontend_uses_exact_funnel_backend_origins(client, monkeypatch):
    config = settings()
    monkeypatch.setattr(config, "environment", "development")
    monkeypatch.setattr(config, "web_origin", "https://planner.vercel.app")
    monkeypatch.setattr(
        config, "development_origins", ["http://localhost:3000", "https://planner.example.ts.net"]
    )
    for origin in [config.web_origin, *config.development_origins]:
        assert (
            client.post(
                "/api/v1/tasks", json={"title": "Capture via " + origin}, headers={"origin": origin}
            ).status_code
            == 201
        )
    assert (
        client.post(
            "/api/v1/tasks",
            json={"title": "Untrusted preview"},
            headers={"origin": "https://planner-random-preview.vercel.app"},
        ).status_code
        == 403
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a-long-test-password"},
        headers={"origin": config.web_origin},
    )
    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie and "HttpOnly" in cookie and "Domain=" not in cookie


def test_forwarded_readiness_is_public_and_contains_no_account_data(stranger):
    stranger.cookies.clear()
    response = stranger.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
