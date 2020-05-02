FROM ubuntu:18.04
ENV APP_USER_NAME='satamoto' \
    APP_USER_ID=1000 \
    APP_GROUP_ID=1000 \
    APP_HOME='/opt/app' \
    NODE_VERSION='v12.16.1'

RUN apt-get update && \
    apt-get install python curl jq vim -y && \
    apt-get clean && \
    rm -r /var/lib/apt/lists/* && \
    groupadd -g ${APP_GROUP_ID} ${APP_USER_NAME} && \
    useradd -u ${APP_USER_ID} -g ${APP_USER_NAME} -s /bin/bash -d ${APP_HOME} ${APP_USER_NAME} && \
    usermod -p '*' ${APP_USER_NAME} && usermod -U ${APP_USER_NAME}

# Install node
RUN cd /opt && \
    curl https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz --output node-${NODE_VERSION}-linux-x64.tar.xz && \
    echo 'b826753f14df9771609ffb8e7d2cc4cb395247cb704cf0cea0f04132d9cf3505  node-v12.16.1-linux-x64.tar.xz' | sha256sum - && \
    tar xf node-${NODE_VERSION}-linux-x64.tar.xz && \
    ln -s /opt/node-${NODE_VERSION}-linux-x64/bin/node /usr/local/bin/node && \
    ln -s /opt/node-${NODE_VERSION}-linux-x64/bin/npm /usr/local/bin/npm && \
    rm node-${NODE_VERSION}-linux-x64.tar.xz

USER root
COPY package.json package-lock.json tsconfig.json tslint.json ${APP_HOME}/
COPY src ${APP_HOME}/src
RUN cd ${APP_HOME} && \
    npm i --only=prod && \
    npm run build && \
    chown -R ${APP_USER_NAME}:${APP_USER_NAME} /opt/node-${NODE_VERSION}-linux-x64 ${APP_HOME}

USER ${APP_USER_NAME}
WORKDIR ${APP_HOME}