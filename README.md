# Pipeline Observatory - CCA 2 (CI/CD with Jenkins, Docker, Kubernetes)

A Flask web app with a live 3D scene (Three.js). Each node in the scene is a stage of the
pipeline that deploys the app. A status card shows the app version, the Jenkins build number
and the **pod that served the request**, so you can see a new release arrive on screen.

**Author:** <Vaibhav Pal, 1262242410, Panel C>  **Course:** TYCSE Cloud Computing and DevOps

## Repository layout
```
app.py  templates/  static/        Flask app and 3D front end
tests/test_app.py                  pytest tests (used in the Build and Test stage)
Dockerfile  .dockerignore          container image
Jenkinsfile                        declarative pipeline
k8s/deployment.yaml  k8s/service.yaml
```

## Pipeline stages
| Stage | What it does |
|---|---|
| Checkout | Jenkins pulls the latest commit from GitHub (triggered by webhook) |
| Build and Test | Creates a venv, installs dependencies, syntax-checks `app.py`, runs `pytest` |
| Docker Build | Builds the image, tagged with the build number and `latest` |
| Push Image | Logs in with the `dockerhub-creds` credential and pushes both tags |
| Deploy to Minikube | Injects the new image tag into the Deployment, applies the manifests, waits for rollout |
| Verify | Lists pods, deployment and service, then calls `/health` and `/api/status` |

## 1. Set up Jenkins on AWS
1. Launch an EC2 instance: Ubuntu 22.04, **m7i-flex.large** (4 vCPU / 8 GB), 50 GB disk.
   Security group inbound: 22 (your IP), 8080 (Jenkins), 30080 (app).
2. Install the tools:
```bash
sudo apt update && sudo apt install -y openjdk-17-jdk docker.io python3-venv python3-pip git curl conntrack
# Jenkins (follow https://www.jenkins.io/doc/book/installing/linux/ for the current repo key)
sudo apt install -y jenkins
# kubectl and minikube
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && sudo install kubectl /usr/local/bin/
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 && sudo install minikube-linux-amd64 /usr/local/bin/minikube
```
3. Let the `jenkins` user run Docker and own the Minikube cluster:
```bash
sudo usermod -aG docker jenkins && sudo usermod -aG docker ubuntu
sudo systemctl restart jenkins
sudo -iu jenkins minikube start --driver=docker --memory=2200
sudo -iu jenkins kubectl get nodes     # should show Ready
```
4. Open `http://<EC2-public-IP>:8080`, unlock Jenkins, install suggested plugins, then add
   **GitHub** and **Pipeline** plugins if missing.

## 2. Credentials and job
* Manage Jenkins > Credentials > Global > Add: kind *Username with password*, ID `dockerhub-creds`,
  username = Docker Hub user, password = a Docker Hub **access token**.
* New Item > Pipeline > *Pipeline script from SCM* > Git > your repo URL > branch `main` > Script Path `Jenkinsfile`.
* Tick *GitHub hook trigger for GITScm polling*, and in GitHub add a webhook:
  `http://<EC2-public-IP>:8080/github-webhook/` (push events).
* Edit `DOCKERHUB_USER` at the top of the `Jenkinsfile`.

## 3. Access the app
The Verify stage prints the URL (`http://<minikube-ip>:30080`). Minikube's IP is private to the EC2 host, so use either:
```bash
# Option A - quick, from the EC2 host
curl http://$(sudo -iu jenkins minikube ip):30080/health
# Option B - open in your browser through the public IP
sudo -iu jenkins kubectl port-forward --address 0.0.0.0 svc/pipeline-observatory 30080:80
# then visit http://<EC2-public-IP>:30080
```

## 4. Second run (code change demo)
Edit `app.py`:
```python
APP_VERSION = "1.1.0" or any 
ACCENT = "#5EEAD4"      # the whole 3D scene changes from amber to teal or we can do anything we want any colour change 
```
`git commit -am "v1.1.0 teal theme" && git push`. The webhook starts a new build; refresh the page and
the version, build number and colour have changed, and `kubectl get pods` shows new pod names.

## Screenshots to submit
1. EC2 instance running and its security group
2. Jenkins dashboard and the pipeline job configuration (SCM section)
3. Credentials page (ID visible, secret hidden)
4. Stage View with all stages green, first run
5. Docker Hub repo showing both tags
6. `kubectl get pods,deployment,svc` output
7. App open in the browser (version 1.0.0)
8. Second run: Stage View, then the app showing 1.1.0 and the new colour


## Run locally
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt && pytest -q && python app.py     # http://localhost:5000
docker build -t pipeline-observatory . && docker run -p 5000:5000 pipeline-observatory
```
