# XRP Ledger Countdown

Reports upcoming XRP Ledger events on Slack.

## Usage

````
npm install
WEBHOOK_URI=<your-slack-webhook-uri> npm start
````

Or to monitor the [XRP Ledger Test Net](https://ripple.com/build/xrp-test-net/)

````
ALTNET=true WEBHOOK_URI=<your-slack-webhook-uri> npm start
````

## Health Endpoint

Available on `/health`, on passed PORT argument or `3000` by default on start.
