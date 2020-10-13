FROM node:12-alpine

WORKDIR /opt

RUN mkdir xrpl-countdown

WORKDIR /opt/xrpl-countdown

COPY . .

# create a group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN npm cache clean --force &&\
    npm install

EXPOSE 3001

# run all future commands as this user
USER appuser 

CMD ["npm", "start"]
