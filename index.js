const countdown = require('countdown')
const CronJob = require('cron').CronJob
const request = require('request-promise')
const Slack = require('slack-node')
const express = require('express')
const app = express()
const log4js = require('log4js')
const port = process.env.PORT || 3000
const log = log4js.getLogger()

// Log Level
log.level = process.env['LOG'] || 'info'

// Constants
const altNet = envBool(process.env['ALTNET'])
const RIPPLED_RPC = altNet ? 'https://s.altnet.rippletest.net:51234' : 'https://s1.ripple.com:51234'
const VL_SITE = altNet ? 'vl.altnet.rippletest.net' : 'vl.ripple.com'
const SLACK_WEBHOOK_URI = process.env['WEBHOOK_URI']

// Health endpoint
app.use('/health', require('./healthcheck'))

// Server
app.listen(port, () => {
  log.info(`XRP Ledger Countdown listening at http://localhost:${port}`)
  log.info(`ALTNET: ${altNet}, RIPPLED_RPC: ${RIPPLED_RPC}, VL_SITE: ${VL_SITE}, Webhook URL present? ${(SLACK_WEBHOOK_URI != null)}`)
  messageSlack('Hey, I am XRP Ledger Countdown and I have just started')
})

var slack = new Slack();
slack.setWebhook(SLACK_WEBHOOK_URI)

const RIPPLE_EPOCH = 946684800
const TWO_WEEKS = 1209600

function parseRippleTime(time) {
  return new Date((time + RIPPLE_EPOCH) * 1000)
}

function messageSlack (message) {
  log.debug(`Sending message to slack: ${message}`)
  slack.webhook({
    text: message
  }, function(err, response) {
    if (err)
    log.error(`Error: ${err}`)
  })
}

function getAmendments() {
  return request({
    method: 'POST',
    uri: RIPPLED_RPC,
    json:true,
    body: {
      method: 'ledger_entry',
      params: [{
        index: '7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4',
        binary: false,
        ledger_index: 'validated'
      }]
    },
    resolveWithFullResponse: true
  }).then(resp => {
    return Promise.resolve(resp.body.result.node)
  })
}

function envBool(variable) {
  if (variable === 'true') {
    return true
  } else {
    return false
  }
}

function getAmendmentMajorities() {
  return getAmendments().then(amendments => {
    const feature_cpp =
      'https://raw.githubusercontent.com/ripple/rippled/develop/src/ripple/protocol/impl/Feature.cpp'
    return request(feature_cpp).then(resp => {
      let majorities = []
      if (amendments.Majorities) {
        for (const majority of amendments.Majorities) {
          const hash = majority.Majority.Amendment
          const start = resp.indexOf(hash)
          majorities.push({
            hash: hash,
            closeTime: majority.Majority.CloseTime,
            name: start == -1 ? undefined : resp.slice(start + 65, resp.indexOf('"', start))
          })
        }
      }
      return majorities
    })
  })
}

function reportAmendmentTimes() {
  return getAmendmentMajorities().then(amendments => {
    const now = Date.now()
    for (const amendment of amendments) {
      const time = countdown(now, parseRippleTime(amendment.closeTime + TWO_WEEKS)).toString()
      messageSlack('Amendment `' + (amendment.name ? amendment.name : amendment.hash) + '` will be enabled in *' + time + '* if majority holds')
    }
  })
}

function getValidatorList() {
  return request.get({
    url: 'https://' + VL_SITE,
    json: true
  }).then(data => {
    return Promise.resolve(data)
  })
}

function reportValListExpiration () {
  return getValidatorList().then(data => {
    const now = Date.now()
    const valList = JSON.parse(new Buffer(data.blob, 'base64').toString('ascii'))
    const time = countdown(now, parseRippleTime(valList.expiration)).toString()
    // if the expiration is more than two weeks into the future, it only reports once a week, on a Monday? 
    // If it’s less than 2 weeks, it can do daily.
    const twoWeeksInMilliseconds = 2 * 7 * 24 * 60 * 60 * 1000
    if (parseRippleTime(valList.expiration) - Date.now() > twoWeeksInMilliseconds) {
      log.debug(`Expiration is more than two weeks into the future`)
      // report only if it is Monday
      const d = new Date()
      if (d.getDay() === 1) {
        log.debug(`Reporting as it is Monday`)
        // Monday
        messageSlack('It is Monday! Current validator list at `' + VL_SITE + '` will expire in *' + time + '*')
      } else {
        log.debug(`Did not report as it is not a Monday`)
      }
    } else {
      messageSlack('Current validator list at `' + VL_SITE + '` will expire in *' + time + '* - less than two weeks!')
    }
  })
}

const countdownCron = new CronJob({
  cronTime: '00 00 9 * * *',
  onTick: function() {
    reportAmendmentTimes()
    reportValListExpiration()
  },
  start: true,
  timeZone: 'America/Los_Angeles'
});
