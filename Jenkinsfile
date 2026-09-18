// Coreliv CI
//
// Requires:
//   - a container runtime on the agent: docker, podman, or podman-docker
//   - the JUnit plugin       (test reporting)
//   - the Timestamper plugin (the timestamps() option)
//
// Deliberately NOT the Docker Pipeline plugin. `docker.image().inside()` runs
// a container, then `docker exec`s every step into it, and that is the part
// that behaves differently under podman. Driving the runtime through plain
// `sh` costs some verbosity and buys the pipeline the freedom to run on
// whichever of the three the agent happens to have.
//
// The whole build runs in containers, so the agent needs no Node and no
// Postgres of its own. The API integration tests get a real Postgres as a
// sidecar on a per-build network - without one they would silently skip, and
// a green pipeline that ran half the suite is worse than no pipeline.

pipeline {
  agent any

  options {
    timestamps()
    // A cold run - pulling images, npm ci, 111 tests, two image builds and
    // the smoke check - lands around 6 minutes; this is headroom.
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
    // Concurrent builds are allowed. What makes that safe: every network and
    // container name carries BUILD_NUMBER, Jenkins gives each concurrent run
    // its own workspace (so HOME and the npm cache are per-build), and both
    // images are tagged with BUILD_NUMBER before anything moves.
    //
    // The one shared thing left is the floating :latest tag, which is
    // last-finisher-wins - the usual semantics for a floating tag, but worth
    // knowing if two builds land together. Add the Lockable Resources plugin
    // and wrap the retag in `lock('coreliv-latest')` if that ever matters.
  }

  environment {
    NODE_IMAGE     = 'node:22-alpine'
    POSTGRES_IMAGE = 'postgres:17-alpine'

    PG_USER = 'coreliv'
    PG_PASS = 'coreliv'
    PG_DB   = 'coreliv'

    IMAGE_API = 'coreliv-api'
    IMAGE_WEB = 'coreliv'

    // Where images are published. `docker push` speaks the registry v2 API
    // and takes a host[:port] with no scheme and no path, so this is not the
    // UI URL: https://registry-ui.ds-core-ops.lan/ is a browser front end
    // onto this registry, not an endpoint a client can push to.
    REGISTRY = 'ds-core-ops.lan:5000'

    // Set to 'true' when the registry serves plain HTTP - the usual default
    // for a registry on :5000 - and the engine is podman, which then gets
    // --tls-verify=false on the push. docker takes no such flag and reads
    // /etc/docker/daemon.json instead, and which of the two applies is the
    // engine Preflight detected, not the name of the binary: /usr/bin/docker
    // on this agent is the podman-docker shim.
    REGISTRY_INSECURE = 'false'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.GIT_SHA}"

          // Which branch this is, for the Push stage's gate. Three sources
          // because three job types answer differently: BRANCH_NAME exists
          // only in a multibranch job, the git plugin sets GIT_BRANCH to
          // something like 'origin/main' in a plain pipeline job, and a
          // checkout that left HEAD detached has neither - so git is asked
          // last rather than first.
          def rawBranch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
          env.BRANCH = rawBranch.replaceFirst(/^origin\//, '')
          echo "Branch: ${env.BRANCH} (images are published only from main)"
        }
      }
    }

    stage('Preflight') {
      steps {
        script {
          // Reports what the agent has, then picks a runtime that can
          // actually start a container - not merely one whose binary exists.
          // Build 1 died on `docker: not found` five lines into Verify; this
          // is where that question gets answered instead.
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

          // Each candidate is tried by running a container, because a binary
          // on PATH proves nothing: a podman-docker shim over a podman that
          // cannot itself start containers would pass a `command -v` check
          // and then fail halfway through the test stage.
          def detected = sh(returnStdout: true, script: """
            set +e
            PICK=""
            for candidate in "docker" "podman" "podman --remote --url unix:///run/docker.sock"; do
              binary=\$(echo "\$candidate" | awk '{print \$1}')
              command -v "\$binary" >/dev/null 2>&1 || { echo "try: \$candidate -> no binary"; continue; }
              if \$candidate run --rm ${env.NODE_IMAGE} true >/dev/null 2>&1; then
                echo "try: \$candidate -> ok"
                PICK="\$candidate"
                break
              fi
              echo "try: \$candidate -> cannot run a container"
            done
            echo "PICK=\$PICK"
            exit 0
          """).trim()

          echo detected
          def pick = (detected =~ /PICK=(.*)/)[0][1].trim()

          if (!pick) {
            error """No usable container runtime on agent '${env.NODE_NAME}'.

Every stage of this pipeline runs in a container. The candidates tried and why
each failed are listed above, and the capability report says what the agent has.

Most likely fixes:
  - rootless podman in an unprivileged agent needs /dev/fuse and subuid/subgid
    mappings, or
  - point podman at the daemon socket the agent already has, via DOCKER_HOST, or
  - install node and npm on the agent and drop the container stages - but the
    API tests would then skip themselves without a reachable Postgres."""
          }

          env.CTR = pick

          // Which engine is actually behind that command. On this agent
          // /usr/bin/docker is the podman-docker shim and `docker --version`
          // answers "podman version 4.3.1", so the name of the binary says
          // nothing about whose config files and whose flags apply. Push
          // needs to know: --tls-verify is podman-only, and an insecure
          // registry is declared in /etc/containers/registries.conf for
          // podman but /etc/docker/daemon.json for docker.
          def version = sh(returnStdout: true, script: "${pick} --version 2>/dev/null || true").trim()
          env.ENGINE = version.toLowerCase().contains('podman') ? 'podman' : 'docker'
          echo "Container runtime: ${env.CTR}  (engine: ${env.ENGINE} - ${version})"

          // Build 5 got as far as starting the Postgres sidecar and then died
          // on `statfs <workspace>: no such file or directory` for the bind
          // mount. The engine resolving a bind mount is not always in the
          // same filesystem namespace as the agent - a socket mounted into a
          // containerised agent is the usual reason - and when it is not, the
          // path the client can read is a path the engine has never heard of.
          //
          // This records which situation we are in. The pipeline copies the
          // workspace in either way (see below), so this is evidence rather
          // than a decision.
          sh """
            set +e
            echo "agent user:   \$(id -un) (\$(id -u):\$(id -g)), HOME=\$HOME"
            echo "workspace:    ${env.WORKSPACE}"
            ls -ld "${env.WORKSPACE}" 2>&1 | sed 's/^/  /'
            echo "engine rootless:  \$(${pick} info --format '{{.Host.Security.Rootless}}' 2>/dev/null || echo unknown)"
            echo "engine remote:    \$(${pick} info --format '{{.Host.ServiceIsRemote}}' 2>/dev/null || echo unknown)"
            echo "engine graphroot: \$(${pick} info --format '{{.Store.GraphRoot}}' 2>/dev/null || echo unknown)"
            exit 0
          """
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
          def jobHost = "coreliv-job-${env.BUILD_NUMBER}"

          try {
            sh """
              set -e
              ${env.CTR} network create ${network}
              ${env.CTR} run -d --name ${dbHost} --network ${network} \\
                -e POSTGRES_USER=${env.PG_USER} \\
                -e POSTGRES_PASSWORD=${env.PG_PASS} \\
                -e POSTGRES_DB=${env.PG_DB} \\
                ${env.POSTGRES_IMAGE}

              # The run returns as soon as the process starts, well before
              # Postgres accepts connections. -d matters: without it pg_isready
              # checks the 'postgres' database, which is ready before
              # POSTGRES_DB has been created.
              for attempt in \$(seq 1 40); do
                if ${env.CTR} exec ${dbHost} pg_isready -U ${env.PG_USER} -d ${env.PG_DB} >/dev/null 2>&1; then
                  echo "Postgres ready after \${attempt} attempt(s)"
                  break
                fi
                if [ "\${attempt}" = "40" ]; then
                  echo 'Postgres never became ready'
                  ${env.CTR} logs ${dbHost} || true
                  exit 1
                fi
                sleep 2
              done
            """

            // The workspace is copied in rather than bind mounted. `cp`
            // streams from the client, so it works whether or not the engine
            // shares a filesystem with the agent - which a bind mount does
            // not, and which is what killed build 5.
            //
            // The npm cache lives in a named volume for the same reason: it
            // is engine-side, so it survives between builds without either
            // end needing to see the other's disk.
            //
            // HOME points at /app because the container's user has no home of
            // its own, and npm fails with EACCES long before any test runs
            // without it.
            sh """
              set -e
              ${env.CTR} rm -f ${jobHost} >/dev/null 2>&1 || true
              ${env.CTR} create --name ${jobHost} --network ${network} -w /app \\
                -e HOME=/app \\
                -e npm_config_cache=/npm-cache \\
                -v coreliv-npm-cache:/npm-cache \\
                -e DATABASE_URL=postgres://${env.PG_USER}:${env.PG_PASS}@${dbHost}:5432/${env.PG_DB} \\
                ${env.NODE_IMAGE} sh -c '
                  set -e
                  node --version && npm --version

                  # npm ci rather than install: it fails loudly when the
                  # lockfile and package.json disagree, which is the point of
                  # running it in CI.
                  npm ci

                  # Typecheck first - a type error is faster to read here than
                  # as a failing assertion. Covers the SPA, the API and the
                  # API tests.
                  npm run typecheck

                  # The suite skips its API half when Postgres is unreachable.
                  # Right for a developer, wrong for CI, so prove the sidecar
                  # is really being used before trusting a pass.
                  node -e "require(\\"pg\\").Client.prototype.constructor && new (require(\\"pg\\").Client)({ connectionString: process.env.DATABASE_URL }).connect().then(function () { console.log(\\"Sidecar reachable - API tests will run\\"); process.exit(0); }).catch(function (e) { console.error(\\"Sidecar unreachable:\\", e.message); process.exit(1); })"

                  npm run test:ci
                '

              # The "/." suffix copies the directory's *contents*. Without
              # it, and because -w already created /app, cp nests the
              # workspace at /app/<name> and npm ci then reports a missing
              # lockfile rather than a missing copy.
              ${env.CTR} cp "${env.WORKSPACE}/." ${jobHost}:/app
              ${env.CTR} start --attach ${jobHost}
            """
          } finally {
            // The report has to come back even when the tests failed - that
            // is precisely when it is worth reading - so this runs before the
            // container is removed and never fails the stage itself.
            sh """
              rm -rf "${env.WORKSPACE}/reports"
              ${env.CTR} cp ${jobHost}:/app/reports "${env.WORKSPACE}/reports" >/dev/null 2>&1 || true
              ${env.CTR} rm -f ${jobHost} >/dev/null 2>&1 || true
              ${env.CTR} rm -f ${dbHost} >/dev/null 2>&1 || true
              ${env.CTR} network rm ${network} >/dev/null 2>&1 || true
            """
          }
        }
      }
      post {
        always {
          // allowEmptyResults, despite wanting to know about a run that tested
          // nothing: when the stage fails before the tests run there is no
          // report, and a strict junit step then throws a second, louder error
          // that buries the first. Vitest already exits non-zero if it matches
          // no test files, so nothing is lost.
          junit testResults: 'reports/junit.xml', allowEmptyResults: true
        }
      }
    }

    stage('Build') {
      steps {
        script {
          // Same copy-in / copy-out shape as Verify, and a second `npm ci`
          // because that container is gone. With the cache volume warm it is
          // seconds, and it buys stages that fail independently instead of
          // one container threaded through the whole pipeline.
          def buildHost = "coreliv-build-${env.BUILD_NUMBER}"
          try {
            sh """
              set -e
              ${env.CTR} rm -f ${buildHost} >/dev/null 2>&1 || true
              ${env.CTR} create --name ${buildHost} -w /app \\
                -e HOME=/app \\
                -e npm_config_cache=/npm-cache \\
                -v coreliv-npm-cache:/npm-cache \\
                ${env.NODE_IMAGE} sh -c 'set -e; npm ci; npm run build; npm run build:api'

              ${env.CTR} cp "${env.WORKSPACE}/." ${buildHost}:/app
              ${env.CTR} start --attach ${buildHost}

              rm -rf "${env.WORKSPACE}/dist"
              ${env.CTR} cp ${buildHost}:/app/dist "${env.WORKSPACE}/dist"
            """
          } finally {
            sh "${env.CTR} rm -f ${buildHost} >/dev/null 2>&1 || true"
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
        sh """
          set -e
          ${env.CTR} build --target api     -t ${env.IMAGE_API}:${env.BUILD_NUMBER} .
          ${env.CTR} build --target runtime -t ${env.IMAGE_WEB}:${env.BUILD_NUMBER} .

          ${env.CTR} tag ${env.IMAGE_API}:${env.BUILD_NUMBER} ${env.IMAGE_API}:latest
          ${env.CTR} tag ${env.IMAGE_WEB}:${env.BUILD_NUMBER} ${env.IMAGE_WEB}:latest

          ${env.CTR} image inspect ${env.IMAGE_API}:${env.BUILD_NUMBER} --format 'api  {{.Id}}'
          ${env.CTR} image inspect ${env.IMAGE_WEB}:${env.BUILD_NUMBER} --format 'web  {{.Id}}'
        """
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

          try {
            sh """
              set -e
              ${env.CTR} network create ${network}

              ${env.CTR} run -d --name ${dbHost} --network ${network} \\
                -e POSTGRES_USER=${env.PG_USER} \\
                -e POSTGRES_PASSWORD=${env.PG_PASS} \\
                -e POSTGRES_DB=${env.PG_DB} \\
                ${env.POSTGRES_IMAGE}

              for attempt in \$(seq 1 40); do
                ${env.CTR} exec ${dbHost} pg_isready -U ${env.PG_USER} -d ${env.PG_DB} >/dev/null 2>&1 && break
                if [ "\${attempt}" = "40" ]; then
                  echo 'Postgres never became ready'
                  ${env.CTR} logs ${dbHost} || true
                  exit 1
                fi
                sleep 2
              done

              # The network alias matters: docker/nginx.conf proxies to the
              # host 'api', so the container has to answer to that name here
              # the same way the compose service does.
              #
              # It starts against an empty database, so this also proves the
              # migrations still apply from nothing.
              ${env.CTR} run -d --name ${apiHost} --network ${network} --network-alias api \\
                -e DATABASE_URL=postgres://${env.PG_USER}:${env.PG_PASS}@${dbHost}:5432/${env.PG_DB} \\
                ${env.IMAGE_API}:${env.BUILD_NUMBER}

              for attempt in \$(seq 1 40); do
                ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                  wget -qO- http://api:3000/healthz >/dev/null 2>&1 && break
                if [ "\${attempt}" = "40" ]; then
                  echo 'API never became healthy'
                  ${env.CTR} logs ${apiHost} || true
                  exit 1
                fi
                sleep 2
              done
              echo 'API healthy'

              ${env.CTR} run -d --name ${webHost} --network ${network} \\
                ${env.IMAGE_WEB}:${env.BUILD_NUMBER}

              for attempt in \$(seq 1 40); do
                ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                  wget -qO- http://${webHost}:8080/healthz >/dev/null 2>&1 && break
                if [ "\${attempt}" = "40" ]; then
                  echo 'nginx never became healthy'
                  ${env.CTR} logs ${webHost} || true
                  exit 1
                fi
                sleep 2
              done
              echo 'nginx healthy'

              echo '--- nginx serves the SPA shell ---'
              ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                wget -qO- http://${webHost}:8080/ | grep -q 'id="root"'

              echo '--- a client-side route falls back to the shell ---'
              ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                wget -qO- http://${webHost}:8080/assets/9f4c1e22-0000-0000-0000-000000000000 \\
                | grep -q 'id="root"'

              echo '--- a missing build asset 404s instead of serving the shell ---'
              if ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                   wget -qO- http://${webHost}:8080/static/does-not-exist.js >/dev/null 2>&1; then
                echo 'a missing asset was served something - nginx is handing out the shell'
                exit 1
              fi

              echo '--- nginx proxies /api to the API, which answers from the database ---'
              ${env.CTR} run --rm --network ${network} ${env.NODE_IMAGE} \\
                wget -qO- http://${webHost}:8080/api/billing/plans | grep -q starter

              echo 'Smoke checks passed'
            """
          } finally {
            sh """
              ${env.CTR} rm -f ${webHost} ${apiHost} ${dbHost} >/dev/null 2>&1 || true
              ${env.CTR} network rm ${network} >/dev/null 2>&1 || true
            """
          }
        }
      }
    }

    stage('Push') {
      // After Smoke rather than after Images, so only a tag that passed the
      // smoke checks can reach the registry. Nothing is rebuilt here - the
      // images already exist locally under their BUILD_NUMBER tags and this
      // only retags and pushes them, so what lands in the registry is
      // byte-for-byte what Smoke just exercised.
      when {
        // Deliberately not `branch 'main'`. That matcher reads BRANCH_NAME,
        // which only exists in a multibranch job; in a plain pipeline job it
        // is null and the stage would quietly skip itself on every build.
        // env.BRANCH is resolved in Checkout from whichever source the job
        // type actually provides.
        expression { env.BRANCH == 'main' }
      }
      steps {
        script {
          def remoteApi = "${env.REGISTRY}/${env.IMAGE_API}"
          def remoteWeb = "${env.REGISTRY}/${env.IMAGE_WEB}"

          // The registry accepts anonymous pushes, so there is no login step.
          // If that changes, add a Jenkins username/password credential and
          // wrap the sh block below in:
          //
          //   withCredentials([usernamePassword(credentialsId: 'coreliv-registry',
          //       usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          //     sh "echo \$REG_PASS | ${env.CTR} login ${env.REGISTRY} -u \$REG_USER --password-stdin"
          //     ...
          //   }
          //
          // --password-stdin rather than -p: the password then never reaches
          // the process table or the build log.

          // podman verifies TLS on push and takes a flag to skip it. docker
          // has no such flag - it decides from /etc/docker/daemon.json before
          // the CLI is involved at all. Keyed off ENGINE rather than CTR
          // because the command here is named `docker` while the engine
          // behind it is podman, and only the engine's opinion counts.
          def tlsOpt = (env.ENGINE == 'podman' && env.REGISTRY_INSECURE == 'true') ? ' --tls-verify=false' : ''

          sh """
            set -e
            ${env.CTR} tag ${env.IMAGE_API}:${env.BUILD_NUMBER} ${remoteApi}:${env.BUILD_NUMBER}
            ${env.CTR} tag ${env.IMAGE_WEB}:${env.BUILD_NUMBER} ${remoteWeb}:${env.BUILD_NUMBER}
            ${env.CTR} tag ${env.IMAGE_API}:${env.BUILD_NUMBER} ${remoteApi}:latest
            ${env.CTR} tag ${env.IMAGE_WEB}:${env.BUILD_NUMBER} ${remoteWeb}:latest

            # The immutable tags go first. If the run dies partway through,
            # the registry is left holding a complete build-number tag with
            # :latest still on the previous build - the recoverable order to
            # fail in, and the reason :latest is pushed rather than built.
            ${env.CTR} push${tlsOpt} ${remoteApi}:${env.BUILD_NUMBER}
            ${env.CTR} push${tlsOpt} ${remoteWeb}:${env.BUILD_NUMBER}
            ${env.CTR} push${tlsOpt} ${remoteApi}:latest
            ${env.CTR} push${tlsOpt} ${remoteWeb}:latest
          """

          // RepoDigests is only populated once an image has actually been
          // pushed, so this reports the digest and confirms the push landed.
          // Never fails the stage - the pushes above are the authority.
          sh """
            set +e
            echo '--- published to ${env.REGISTRY} ---'
            ${env.CTR} image inspect ${remoteApi}:${env.BUILD_NUMBER} --format 'api  {{index .RepoDigests 0}}' 2>/dev/null
            ${env.CTR} image inspect ${remoteWeb}:${env.BUILD_NUMBER} --format 'web  {{index .RepoDigests 0}}' 2>/dev/null
            exit 0
          """

          echo 'Browse: https://registry-ui.ds-core-ops.lan/'
        }
      }
      post {
        failure {
          echo """Push to ${env.REGISTRY} failed.

The build itself is sound - everything through Smoke passed, and both images
are still on agent '${env.NODE_NAME}' under their local tags. Only publishing
failed, so this is a name, trust or credentials problem, not a code problem.

The engine here is ${env.ENGINE}, which is what decides where the fixes below
go. Note that /usr/bin/docker can be the podman-docker shim, so the name of
the binary is not the answer - the Preflight line above is.

Match the error text against these, in order:
  - 'no such host' - REGISTRY does not resolve, and no pipeline change fixes
    that: either the name is wrong or the resolver does not know it. The push
    is made by the engine, which when remote or rootless need not share a
    resolver with the agent shell, so test where the engine actually runs:
      ${env.CTR} run --rm ${env.NODE_IMAGE} getent hosts <host>
    Remember that https://registry-ui.ds-core-ops.lan/ is the browser UI onto
    the registry, not a push target: push speaks the registry v2 API and takes
    a host[:port] with no scheme and no path.
  - 'server gave HTTP response to HTTPS client' - the registry is plain HTTP.
    For podman, set REGISTRY_INSECURE = 'true' in the environment block above,
    or declare it in /etc/containers/registries.conf on the agent. For docker,
    add it to /etc/docker/daemon.json and restart the daemon:
      { "insecure-registries": ["${env.REGISTRY}"] }
  - 'certificate signed by unknown authority' - a private CA the engine does
    not trust. Drop the CA cert at
      /etc/containers/certs.d/${env.REGISTRY}/ca.crt   (podman)
      /etc/docker/certs.d/${env.REGISTRY}/ca.crt       (docker)
  - 'unauthorized' or 'authentication required' - anonymous push is no longer
    allowed; see the withCredentials sketch in the stage above."""
        }
      }
    }
  }

  post {
    always {
      // Deliberately not cleanWs: the workspace is worth keeping between
      // builds for the npm cache, `npm ci` replaces node_modules itself, and
      // `dist` is overwritten - so nothing here grows without bound. Add the
      // Workspace Cleanup plugin and call cleanWs() here to start clean.
      sh 'rm -rf reports || true'
    }
    failure {
      echo "Build ${env.BUILD_NUMBER} (${env.GIT_SHA}) failed - the first failing stage above is the one to read."
    }
  }
}
