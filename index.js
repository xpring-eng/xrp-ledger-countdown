const countdown = require('countdown')
const CronJob = require('cron').CronJob
const request = require('request-promise')
const express = require('express')
const { RTMClient } = require('@slack/client')
const app = express()
const log4js = require('log4js')
const port = process.env.PORT || 3000
const log = log4js.getLogger()

// Log Level
log.level = process.env['LOG'] || 'info'

// Constants
const altNet = envBool(process.env['ALTNET'])
const devNet = envBool(process.env['DEVNET'])
const RIPPLED_RPC = devNet ? 'https://s.devnet.rippletest.net:51234' : altNet ? 'https://s.altnet.rippletest.net:51234' : 'https://s1.ripple.com:51234'
const VL_SITE = devNet ? 'vl.devnet.rippletest.net:51234' : altNet ? 'vl.altnet.rippletest.net' : 'vl.ripple.com'
const SLACK_CHANNEL_ID = process.env['SLACK_CHANNEL_ID']
const SLACK_TOKEN = process.env['SLACK_TOKEN']

// Health endpoint
app.use('/health', require('./healthcheck'))
var rtmClient = new RTMClient(SLACK_TOKEN)
rtmClient.on('ready', () => log.info('Slack: ready'))

// Server
app.listen(port, async () => {
  log.info(`XRP Ledger Countdown listening at http://localhost:${port}`)
  log.info(`ALTNET: ${altNet}, RIPPLED_RPC: ${RIPPLED_RPC}, VL_SITE: ${VL_SITE}, Channel: ${SLACK_CHANNEL_ID}`)
  await rtmClient.start()
  messageSlack('Hey, I am XRP Ledger Countdown and I have just started')
})

const messageSlack = async (message) => {
  log.info(
    `Message: ${message} | Channel: ${SLACK_CHANNEL_ID}`,
  )

  if (!SLACK_CHANNEL_ID) {
    log.error('No channel found')
    throw new Error("No Slack Channel ID")
  }

  try {
    await rtmClient.sendMessage(message, SLACK_CHANNEL_ID)
  } catch (err) {
    console.log(
      `Failed to send message. Ensure that I am a member of channel ${SLACK_CHANNEL}. Error:`,
      err,
    )
  }
}

const RIPPLE_EPOCH = 946684800
const TWO_WEEKS = 1209600

function parseRippleTime(time) {
  return new Date((time + RIPPLE_EPOCH) * 1000)
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
