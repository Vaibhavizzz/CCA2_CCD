"""Pipeline Observatory - a live 3D view of a CI/CD pipeline, served by Flask."""
import os
import socket
import time

from flask import Flask, jsonify, render_template

app = Flask(__name__)

# --- Change these two values for the "second run" demo -------------------
APP_VERSION = "1.2.0"
ACCENT = "#F43F5E"  # try "#5EEAD4" (teal) or "#FF7A90" (coral) for v1.1.0
# --------------------------------------------------------------------------

BUILD_NUMBER = os.getenv("BUILD_NUMBER", "local")
STARTED_AT = time.time()

STAGES = [
    {"name": "Source", "tool": "GitHub",
     "text": "Your code, Dockerfile, Jenkinsfile and k8s manifests live in one repository."},
    {"name": "Checkout", "tool": "Jenkins",
     "text": "A push triggers Jenkins, which pulls the latest commit onto the AWS server."},
    {"name": "Build and test", "tool": "Python, pytest",
     "text": "Dependencies are installed, the code is syntax-checked and the tests run."},
    {"name": "Docker build", "tool": "Docker",
     "text": "The Dockerfile packages the app and gunicorn into a small, tagged image."},
    {"name": "Push image", "tool": "Docker Hub",
     "text": "Jenkins logs in with stored credentials and pushes the build-number tag."},
    {"name": "Deploy", "tool": "Minikube, kubectl",
     "text": "The Deployment and Service are applied and Kubernetes pulls the new image."},
    {"name": "Verify", "tool": "kubectl, curl",
     "text": "Pods, deployment and service are checked, then /health must answer 200."},
]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/api/status")
def status():
    return jsonify(
        version=APP_VERSION,
        build=BUILD_NUMBER,
        accent=ACCENT,
        pod=socket.gethostname(),
        uptime_seconds=int(time.time() - STARTED_AT),
    )


@app.route("/api/pipeline")
def pipeline():
    return jsonify(stages=STAGES)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
