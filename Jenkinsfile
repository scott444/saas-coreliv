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
    // Concurrent builds are allowed. What makes that safe: every network and
    // container name carries BUILD_NUMBER, Jenkins gives each concurrent run
    // its own workspace (so HOME and the npm cache below are per-build), and
    // both image builds are tagged with BUILD_NUMBER before anything moves.
    //
    // The one shared thing left is the floating :latest tag, which is
    // last-finisher-wins - the usual semantics for a floating tag, but worth
    // knowing if two builds land together and you then `docker compose up`.
    // Add the Lockable Resources plugin and wrap the retag in `lock('coreliv-latest')`
    // if that ordering ever matters.
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

    stage('Preflight') {
      steps {
        script {
          // Build 1 died on `docker: not found` five lines into the Verify
          // stage. This reports what the agent actually has before anything
          // depends on it, so a missing tool reads as a missing tool rather
          // than as exit code 127 from a shell three containers deep.
          def report = sh(returnStdout: true, script: '''
            set +e
            echo "host:        $(uname -srm 2>/dev/null || echo unknown)"
            for tool in git node npm docker podman nerdctl; do
              found=$(command -v $tool 2>/dev/null)
              if [ -n "$found" ]; then
                echo "$tool: $found  $($tool --version 2>/dev/null | head -1)"
              else
                echo "$tool: not found"
              fi
            done
            for sock in /var/run/docker.sock /run/docker.sock /run/podman/podman.sock; do
              [ -S "$sock" ] && echo "socket:      $sock present"
            done
            echo "DOCKER_HOST: ${DOCKER_HOST:-unset}"
            exit 0
          ''').trim()

          echo "Agent ${env.NODE_NAME} capabilities:"
          echo report

          def hasDocker = sh(returnStatus: true, script: 'command -v docker >/dev/null 2>&1') == 0
          if (!hasDocker) {
            // Triple-quoted so the message can span lines without escapes.
            error """No docker CLI on agent '${env.NODE_NAME}'.

Every stage of this pipeline runs in a container, so it needs one. Either:
  a) give the agent a docker CLI and a reachable daemon socket, or
  b) switch to the NodeJS tool plugin and drop the Images and Smoke stages -
     the API integration tests then need a reachable Postgres, or they skip
     themselves and the pipeline goes green having run half the suite.

The capability report above says what this agent does have."""
          }
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
          // allowEmptyResults, despite wanting to know about a run that
          // tested nothing: when the stage fails before the tests run there
          // is no report, and a strict junit step then throws a second,
          // louder error that buries the first. Vitest already exits
          // non-zero if it matches no test files, so nothing is lost.
          junit testResults: 'reports/junit.xml', allowEmptyResults: true
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

          // Builds the wait script rather than running it: calling a step
          // like sh() from inside a closure is a CPS pitfall in Jenkins
          // pipeline, so the closure stays a pure string function and sh is
          // called at the top level.
          def waitScript = { String url, String container ->
            """
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
                sh waitScript("http://api:3000/healthz", apiHost)

                docker.image("${env.IMAGE_WEB}:${env.BUILD_NUMBER}").withRun(
                  "--name ${webHost} --network ${network}"
                ) {
                  sh waitScript("http://${webHost}:8080/healthz", webHost)

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
