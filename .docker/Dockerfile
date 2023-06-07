FROM node:hydrogen-alpine

# - stop vulnerabilities:package HIGH Vulnerability found in os package type (APKG) - libcrypto3 (fixed in: 3.0.8-r2)(CVE-2023-0464 - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0464)
# - stop vulnerabilities:package HIGH Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r1)(CVE-2023-0464 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0464)
# - stop vulnerabilities:package MEDIUM Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r2)(CVE-2023-0465 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0465)
# - stop vulnerabilities:package MEDIUM Vulnerability found in os package type (APKG) - libssl3 (fixed in: 3.0.8-r3)(CVE-2023-0466 https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-0466)
RUN apk add --no-cache --upgrade libcrypto3 libssl3

ARG COMMIT_SHA
ARG VERSION=latest

LABEL name="mystery-box" \
      description="publish action for mia CDN service" \
      eu.mia-platform.url="https://www.mia-platform.eu" \
      eu.mia-platform.version=${VERSION}

WORKDIR /usr/src/app

COPY ./dist/index.cjs ./dist/index.cjs
COPY ./package.json ./package.json
COPY ./LICENSE ./LICENSE

RUN npm i -g .

RUN echo "mystery-box: $COMMIT_SHA" >> ./commit.sha

USER node

HEALTHCHECK NONE
