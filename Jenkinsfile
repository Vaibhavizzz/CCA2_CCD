pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_USER = 'vaibhaviz'   // <-- change this
        IMAGE_NAME     = "${DOCKERHUB_USER}/pipeline-observatory"
        IMAGE_TAG      = "${BUILD_NUMBER}"
        REGISTRY_CREDS = 'dockerhub-creds'            // Jenkins credentials ID
        APP_LABEL      = 'app=pipeline-observatory'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Build and Test') {
            steps {
                sh '''
                    python3 -m venv .venv
                    . .venv/bin/activate
                    pip install -q -r requirements-dev.txt
                    python -m py_compile app.py
                    pytest -q
                '''
            }
        }

        stage('Docker Build') {
            steps {
                sh """
                    docker build --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:latest .
                """
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([usernamePassword(credentialsId: "${REGISTRY_CREDS}",
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_PASS')]) {
                    sh '''
                        echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:latest
                    '''
                }
            }
        }

        stage('Deploy to Minikube') {
            steps {
                sh '''
                    sed "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}:${IMAGE_TAG}|" k8s/deployment.yaml | kubectl apply -f -
                    kubectl apply -f k8s/service.yaml
                    kubectl rollout status deployment/pipeline-observatory --timeout=180s
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    kubectl get pods -l ${APP_LABEL} -o wide
                    kubectl get deployment pipeline-observatory
                    kubectl get svc pipeline-observatory
                    URL="http://$(minikube ip):30080"
                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        curl -fsS "$URL/health" && break
                        echo "waiting for app... ($i)"; sleep 3
                    done
                    curl -fsS "$URL/api/status"
                    echo
                    echo "App is running at $URL"
                '''
            }
        }
    }

    post {
        always  { sh 'docker logout || true' }
        success { echo "Deployed ${IMAGE_NAME}:${IMAGE_TAG}" }
        failure { echo 'Pipeline failed - open Console Output and check the failing stage.' }
    }
}
