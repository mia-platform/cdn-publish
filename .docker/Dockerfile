FROM node:hydrogen-alpine

# - stop vulnerabilities:package HIGH Vulnerability found in os package type (APKG) - libcrypto3 (fixed in: 3.0.8-r2)(CVE-2023-0464 - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0464)
# - stop vulnerabilities:package HIGH Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r1)(CVE-2023-0464 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0464)
# - stop vulnerabilities:package MEDIUM Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r2)(CVE-2023-0465 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0465)
# - stop vulnerabilities:package MEDIUM Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r3)(CVE-2023-0466 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0466)
RUN apk add --no-cache --upgrade libcrypto3 libssl3

RUN apk add --no-cache tini

ARG COMMIT_SHA
ARG VERSION=latest

ENV NPM_CONFIG_CACHE="/tmp"
ENV HTTP_PORT=3000
ENV LOG_LEVEL=info
ENV SERVICE_PREFIX=/
ENV NODE_ENV=production

LABEL name="bo-notifications-backend" \
      description="bff for bk-notifications-backend" \
      eu.mia-platform.url="https://www.mia-platform.eu" \
      eu.mia-platform.version=${VERSION}

COPY ./package.json package.json
COPY ./package-lock.json package-lock.json
COPY ./LICENSE LICENSE
COPY ./build build

RUN echo "bo-notifications-backend: $COMMIT_SHA" >> ./commit.sha

RUN npm ci --only=dev --ignore-scripts

USER node

ENTRYPOINT ["/sbin/tini", "--"]

CMD ./node_modules/.bin/lc39 ./build/index.js --port=${HTTP_PORT} --log-level=${LOG_LEVEL}
