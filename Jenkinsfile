// Coreliv CI
//
// Requires:
//   - a Docker daemon the Jenkins user can talk to
//   - the Docker Pipeline plugin      (docker.image / docker.build)
//   - the JUnit plugin                (test reporting)
//   - the Timestamper plugin          (the timestamps() option)
//
// The whole build runs in containers, so the agent needs no Node, no npm and
// no Postgres of its own. The API integration tests get a real Postgres as a
// sidecar on a per-build network - without one they would silently skip, and
// a green pipeline that ran half the suite is worse than no pipeline.

pipeline {
  agent any

  options {
    timestamps()
    // A cold run - pulling both images, npm ci, 111 tests, two image
    // builds and the smoke check - lands around 6 minutes; this is headroom,
    // not an estimate.
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    // Each build makes its own network and container names, so builds do not
    // collide; this is only here because they share the local image tags.
    disableConcurrentBuilds()
  }

  environment {
    NODE_IMAGE     = 'node:22-alpine'
    POSTGRES_IMAGE = 'postgres:17-alpine'

    PG_USER = 'coreliv'
    PG_PASS = 'coreliv'
    PG_DB   = 'coreliv'

    // `docker.image(...).inside()` runs as the Jenkins uid, which has no home
    // inside the container. Without these, npm tries to write to / and fails
    // with EACCES long before any test runs.
    HOME             = "${env.WORKSPACE}"
    npm_config_cache = "${env.WORKSPACE}/.npm-cache"

    IMAGE_API = 'coreliv-api'
    IMAGE_WEB = 'coreliv'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.GIT_SHA}"
        }
      }
    }

    stage('Verify') {
      steps {
        script {
          // A network per build so the sidecar is addressable by name and two
          // builds on one agent can never reach each other's database.
          def network = "coreliv-ci-${env.BUILD_NUMBER}"
          def dbHost = "coreliv-db-${env.BUILD_NUMBER}"

          sh "docker network create ${network}"
          try {
            docker.image(env.POSTGRES_IMAGE).withRun(
              "--name ${dbHost} --network ${network}" +
              " -e POSTGRES_USER=${env.PG_USER}" +
              " -e POSTGRES_PASSWORD=${env.PG_PASS}" +
              " -e POSTGRES_DB=${env.PG_DB}"
            ) {
              // `docker run` returns as soon as the process starts, which is
              // well before Postgres accepts connections. -d matters: without
              // it pg_isready checks the `postgres` database, which is ready
              // before POSTGRES_DB has been created.
              sh """
                for attempt in \$(seq 1 40); do
                  if docker exec ${dbHost} pg_isready -U ${env.PG_USER} -d ${env.PG_DB} >/dev/null 2>&1; then
                    echo "Postgres ready after \${attempt} attempt(s)"
                    exit 0
                  fi
                  sleep 2
                done
                echo 'Postgres never became ready'
                docker logs ${dbHost} || true
                exit 1
              """

              docker.image(env.NODE_IMAGE).inside(
                "--network ${network}" +
                " -e DATABASE_URL=postgres://${env.PG_USER}:${env.PG_PASS}@${dbHost}:5432/${env.PG_DB}"
              ) {
                sh 'node --version && npm --version'

                // `npm ci` rather than install: it fails loudly if the
                // lockfile and package.json disagree, which is the whole
                // point of running it in CI.
                sh 'npm ci'

                // Typecheck before tests: a type error is faster to find here
                // than in a failing assertion, and this covers the SPA, the
                // API, and the API tests themselves.
                sh 'npm run typecheck'

                // The suite skips its API half when Postgres is unreachable.
                // That is right for a developer and wrong for CI, so prove
                // the sidecar is actually being used before trusting a pass.
                sh '''
                  node -e "
                    const { Client } = require('pg');
                    new Client({ connectionString: process.env.DATABASE_URL })
                      .connect()
                      .then(() => { console.log('Sidecar reachable - API tests will run'); process.exit(0); })
                      .catch((e) => { console.error('Sidecar unreachable:', e.message); process.exit(1); });
                  "
                '''

                sh 'npm run test:ci'
              }
            }
          } finally {
            // withRun stops the container; the network is ours to clean up.
            sh "docker network rm ${network} || true"
          }
        }
      }
      post {
        always {
          junit testResults: 'reports/junit.xml', allowEmptyResults: false
        }
      }
    }

    stage('Build') {
      steps {
        script {
          docker.image(env.NODE_IMAGE).inside {
            // Runs tsc -b again before vite build, exactly as the image does.
            sh 'npm run build'
            sh 'npm run build:api'
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/**', fingerprint: true, onlyIfSuccessful: true
        }
      }
    }

    stage('Images') {
      steps {
        script {
          // Built from the same Dockerfile targets compose uses, and left in
          // the agent's local daemon under the tags compose expects, so a
          // `docker compose up` on this machine picks up what CI just built.
          def api = docker.build("${env.IMAGE_API}:${env.BUILD_NUMBER}", '--target api .')
          def web = docker.build("${env.IMAGE_WEB}:${env.BUILD_NUMBER}", '--target runtime .')

          api.tag('latest')
          web.tag('latest')

          sh "docker image inspect ${env.IMAGE_API}:${env.BUILD_NUMBER} --format 'api  {{.Id}} {{.Size}} bytes'"
          sh "docker image inspect ${env.IMAGE_WEB}:${env.BUILD_NUMBER} --format 'web  {{.Id}} {{.Size}} bytes'"
        }
      }
    }

    stage('Smoke') {
      steps {
        script {
          // An image that builds is not an image that works. This runs the
          // real chain - Postgres, the API against it, nginx in front - and
          // asks nginx for something only the API can answer.
          def network = "coreliv-smoke-${env.BUILD_NUMBER}"
          def dbHost = "coreliv-smoke-db-${env.BUILD_NUMBER}"
          def apiHost = "coreliv-smoke-api-${env.BUILD_NUMBER}"
          def webHost = "coreliv-smoke-web-${env.BUILD_NUMBER}"

          // Waits for an HTTP endpoint from a throwaway container on the same
          // network, so nothing has to be published to the agent's ports.
          def waitFor = { String url, String container ->
            sh """
              for attempt in \$(seq 1 40); do
                if docker run --rm --network ${network} ${env.NODE_IMAGE} wget -qO- ${url} >/dev/null 2>&1; then
                  echo "${url} answered after \${attempt} attempt(s)"
                  exit 0
                fi
                sleep 2
              done
              echo "${url} never answered"
              docker logs ${container} || true
              exit 1
            """
          }

          sh "docker network create ${network}"
          try {
            docker.image(env.POSTGRES_IMAGE).withRun(
              "--name ${dbHost} --network ${network}" +
              " -e POSTGRES_USER=${env.PG_USER}" +
              " -e POSTGRES_PASSWORD=${env.PG_PASS}" +
              " -e POSTGRES_DB=${env.PG_DB}"
            ) {
              sh """
                for attempt in \$(seq 1 40); do
                  docker exec ${dbHost} pg_isready -U ${env.PG_USER} -d ${env.PG_DB} >/dev/null 2>&1 && exit 0
                  sleep 2
                done
                echo 'Postgres never became ready'
                docker logs ${dbHost} || true
                exit 1
              """

              // The network alias matters: nginx.conf proxies to the host
              // `api`, so the container has to answer to that name here the
              // same way the compose service does.
              docker.image("${env.IMAGE_API}:${env.BUILD_NUMBER}").withRun(
                "--name ${apiHost} --network ${network} --network-alias api" +
                " -e DATABASE_URL=postgres://${env.PG_USER}:${env.PG_PASS}@${dbHost}:5432/${env.PG_DB}"
              ) {
                // Against an empty database, so this also proves the
                // migrations still apply from nothing.
                waitFor("http://api:3000/healthz", apiHost)

                docker.image("${env.IMAGE_WEB}:${env.BUILD_NUMBER}").withRun(
                  "--name ${webHost} --network ${network}"
                ) {
                  waitFor("http://${webHost}:8080/healthz", webHost)

                  sh """
                    set -e
                    echo '--- nginx serves the SPA shell ---'
                    docker run --rm --network ${network} ${env.NODE_IMAGE}                       wget -qO- http://${webHost}:8080/ | grep -q '<div id="root">'

                    echo '--- a client-side route falls back to the shell ---'
                    docker run --rm --network ${network} ${env.NODE_IMAGE}                       wget -qO- http://${webHost}:8080/assets/9f4c1e22-0000-0000-0000-000000000000                       | grep -q '<div id="root">'

                    echo '--- a missing build asset 404s instead of serving the shell ---'
                    docker run --rm --network ${network} ${env.NODE_IMAGE}                       wget -qO- http://${webHost}:8080/static/does-not-exist.js && exit 1 || true

                    echo '--- nginx proxies /api to the API, which answers from the database ---'
                    docker run --rm --network ${network} ${env.NODE_IMAGE}                       wget -qO- http://${webHost}:8080/api/billing/plans | grep -q starter
                  """
                }
              }
            }
          } finally {
            sh "docker network rm ${network} || true"
          }
        }
      }
    }
  }

  post {
    always {
      // Deliberately not cleanWs: the workspace is worth keeping between
      // builds for the npm cache, `npm ci` replaces node_modules itself, and
      // `dist` is overwritten - so nothing here grows without bound. Add the
      // Workspace Cleanup plugin and call cleanWs() here if you would rather
      // start every build from an empty directory.
      sh 'rm -rf reports || true'
    }
    failure {
      echo "Build ${env.BUILD_NUMBER} (${env.GIT_SHA}) failed - the first failing stage above is the one to read."
    }
  }
}
