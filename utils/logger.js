const winston = require('winston')
require('winston-daily-rotate-file')
const { app } = require('electron')

let LOG_LEVEL

let MAIN_LOGGER
let BACKEND_LOGGER
let SESSION_LOGGER
let DHT_LOGGER
let UDP_LOGGER
let NOSTRCLIENT_LOGGER
let RENDERER_LOGGER
const USERDATAPATH = app.getPath('userData')

const rotateTransportAll = new winston.transports.DailyRotateFile({
  filename: USERDATAPATH + '/logs/all-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '10d'
})

const startLogger = function(level) {
  setLogLevel(level)
  startMainLogger()
  startBackendLogger()
  startSessionLogger()
  startDhtLogger()
  startUdpLogger()
  startNostrClientLogger()
  startRendererLogger()
}

const setLogLevel = function(level) {
  level = level.toLowerCase()
  const isValidLevel = ['info', 'debug'].includes(level)
  if (!isValidLevel) {
    LOG_LEVEL = 'info'
    return
  }
  LOG_LEVEL = level
}

const startMainLogger = function() {

  MAIN_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [MAIN] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  MAIN_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startBackendLogger = function() {
  BACKEND_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [BACKEND] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  BACKEND_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startSessionLogger = function() {
  SESSION_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [SESSION] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  SESSION_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startDhtLogger = function() {
  DHT_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [DHT server] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  DHT_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startUdpLogger = function() {
  UDP_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [UDP server] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  UDP_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startNostrClientLogger = function() {
  NOSTRCLIENT_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [NOSTR CLIENT] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  NOSTRCLIENT_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const startRendererLogger = function() {
  RENDERER_LOGGER = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: [RENDERER] - ${info.message}`
      )
    ),
    transports: [
      new winston.transports.Console(),
      rotateTransportAll
    ],
  })
  RENDERER_LOGGER.info(`log level set to ${LOG_LEVEL}`)
}

const getMainLogger = function() {
  return MAIN_LOGGER
}

const getBackendLogger = function() {
  return BACKEND_LOGGER
}

const getSessionLogger = function() {
  return SESSION_LOGGER
}

const getDhtLogger = function() {
  return DHT_LOGGER
}

const getUdpLogger = function() {
  return UDP_LOGGER
}

const getNostrClientLogger = function() {
  return NOSTRCLIENT_LOGGER
}

const getRendererLogger = function() {
  return RENDERER_LOGGER
}

const closeLoggers = function() {
  try {
    MAIN_LOGGER.end()
    BACKEND_LOGGER.end()
    SESSION_LOGGER.end()
    DHT_LOGGER.end()
    UDP_LOGGER.end()
    NOSTRCLIENT_LOGGER.end()
    RENDERER_LOGGER.end()
  }
  catch(err) {}
}

module.exports = {
  startLogger,
  getMainLogger,
  getBackendLogger,
  getSessionLogger,
  getDhtLogger,
  getUdpLogger,
  getNostrClientLogger,
  getRendererLogger,
  closeLoggers
}
