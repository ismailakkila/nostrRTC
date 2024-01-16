const uuid = require('uuid')
const { Duplex } = require('stream')
const fs = require('fs')
const b4a = require('b4a')
const { sha256 } = require('@noble/hashes/sha256')
const crypto = require('crypto')
const streamPromises = require('node:stream/promises')
const { isUUID } = require('validator')

const helpers =  {
  getRandomPort: function() {
    let port = Math.floor(Math.random() * 65536)
    while (port < 10000) {
      port = Math.floor(Math.random() * 65536)
    }
    return port
  },
  isRequest: function(request) {
    const { data, method, path, requestId } = request
    return (
      data &&
      method &&
      path &&
      requestId
    ) && (
      typeof data === 'object' && data.constructor.name === 'Object' &&
      typeof method === 'string' &&
      typeof path === 'string' &&
      isUUID(requestId)
    )
  },
  isResponse: function(response) {
    const { status, requestId} = response
    return (
      status &&
      requestId
    ) && (
      typeof status === 'number' &&
      isUUID(requestId)
    )
  },
  generateResponse: function(requestId, status) {
    return JSON.stringify({
      requestId: requestId,
      status: status
    })
  },
  generateRequest: function(method, path, data) {
    return JSON.stringify({
      requestId: uuid.v4(),
      method: method,
      path: path,
      data: data
    })
  },
  outputToConsole: function() {
    return new Duplex({
      read: function() {},
      write: function(chunk, encoding, cb) {
        console.log(chunk.toString())
        cb()
      }
    })
  },
  getFileHashAsync: async function(filePath) {
    const fileStream = fs.createReadStream(filePath)
    const fileHash = crypto.createHash('sha256')
    await streamPromises.pipeline(fileStream, fileHash)
    return fileHash.digest('hex')
  },
  getFileHashSync: function(filePath) {
    const fileBuffer = fs.readFileSync(filePath)
    const data = new TextEncoder().encode(fileBuffer)
    return b4a.toString(sha256(data), 'hex')
  },
  getObjectHash: function(obj) {
    const data = new TextEncoder().encode(JSON.stringify(obj))
    return b4a.toString(sha256(data), 'hex')
  },
  isFile: function(filePath) {
    try {
      return fs.lstatSync(filePath).isFile()
    }
    catch(err) {
      return false
    }
  }
}

module.exports = helpers
