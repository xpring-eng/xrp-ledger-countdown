# XRP Ledger Countdown

Reports upcoming XRP Ledger events on Slack.

## Usage

````
npm install
SLACK_TOKEN=<slack_token> SLACK_CHANNEL_ID=<channel_id> npm start

# Monitor XRPL Testnet:
ALTNET=true SLACK_TOKEN=<slack_token> SLACK_CHANNEL_ID=<channel_id> npm start

# Monitor XRPL Devnet:
DEVNET=true SLACK_TOKEN=<slack_token> SLACK_CHANNEL_ID=<channel_id> npm start
````

- [More info about parallel networks](https://xrpl.org/parallel-networks.html)

## Health Endpoint

Available on `/health`, on passed PORT argument (or `3000` by default) on start.
