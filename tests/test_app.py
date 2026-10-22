import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import app  # noqa: E402


def client():
    app.config["TESTING"] = True
    return app.test_client()


def test_home_page_renders():
    r = client().get("/")
    assert r.status_code == 200
    assert b"<canvas" in r.data


def test_health():
    r = client().get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_status_fields():
    data = client().get("/api/status").get_json()
    for key in ("version", "build", "accent", "pod", "uptime_seconds"):
        assert key in data
    assert data["accent"].startswith("#")


def test_pipeline_has_seven_stages():
    stages = client().get("/api/pipeline").get_json()["stages"]
    assert len(stages) == 7
    assert stages[0]["tool"] == "GitHub"
