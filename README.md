# XRP Ledger Countdown

Reports upcoming XRP Ledger events on Slack.

## Usage

````
npm install
ALTNET=false SLACK_TOKEN=<slack_token> SLACK_CHANNEL_ID=<channel_id> npm start
````

Or to monitor the [XRP Ledger Test Net](https://ripple.com/build/xrp-test-net/)

````
ALTNET=true SLACK_TOKEN=<slack_token> SLACK_CHANNEL_ID=<channel_id> npm start
````

## Health Endpoint

Available on `/health`, on passed PORT argument or `3000` by default on start.
