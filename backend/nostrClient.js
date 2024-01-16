require('websocket-polyfill')
global.crypto =  require('node:crypto').webcrypto
const EventEmitter = require('events')
const DHT = require('hyperdht')
const b4a = require('b4a')
const { sha256 } = require('@noble/hashes/sha256')
const { schnorr } = require('@noble/curves/secp256k1')
const fetch = require('cross-fetch')
const { getParams } = require('js-lnurl')
const { webln } = require('@getalby/sdk')
const {
  generateSecretKey,
  SimplePool,
  nip04,
  nip05,
  nip19,
  getPublicKey,
  finalizeEvent
} = require('nostr-tools')
const {
  isEmail,
  isHexadecimal,
  isFQDN,
  isURL
} = require('validator')

const DEFAULT_NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.primal.net'
]

const MAX_NUM_RELAYS = 5

class NostrClient extends EventEmitter {
  constructor(secret, nwc, metadata, relayList, options) {
    super()
    this.logger = options.logger
    if (!secret) {
      secret = b4a.toString(generateSecretKey(), 'hex')
    }
    const secretBuffer = Buffer.from(secret, 'hex')
    this.secret = secret
    this.nsec = nip19.nsecEncode(secretBuffer)
    this.pub = getPublicKey(secret)
    this.npub = nip19.npubEncode(this.pub)
    const keyPair = DHT.keyPair(
      Buffer.from(this.generateSeed(secret), 'hex')
    )
    this.nostrRTCSecret = b4a.toString(keyPair.secretKey, 'hex')
    this.nostrRTCPub = b4a.toString(keyPair.publicKey, 'hex')
    if (relayList) {
      this.relayList = relayList
    }
    else {
      this.relayList = {
        createdAt: 0,
        list: []
      }
    }
    if (
      !metadata ||
      (metadata.pubkey !== getPublicKey(secret))

    ) {
      this.metadata = {
        created_at: 0
      }
      this.profile = {
        title: this.npub,
        description: '',
        pictureUrl: '',
        lud06: '',
        lud16: ''
      }
    }
    else {
      this.metadata = metadata
      this.profile = this.createProfile(metadata)
    }
    this.muteList = {
      createdAt: 0,
      list: []
    }
    if (!nwc) {
      this.nwc = ''
    }
    else {
      this.nwc = nwc
    }
    this.followList = {
      createdAt: 0,
      map: new Map()
    }
  }

  sign(hash) {
    return b4a.toString(
      schnorr.sign(hash, this.secret),
      'hex'
    )
  }

  verify(sig, hash, pub=null) {
    if (pub) {
      return schnorr.verify(
        sig,
        hash,
        pub
      )
    }
    return schnorr.verify(
      sig,
      hash,
      this.pub
    )
  }

  generateSeed(secret) {
    const seed = new TextEncoder().encode(
      Buffer.concat([
        Buffer.from('nostrRTC:'),
        Buffer.from(secret, 'hex')
      ])
    )
    return b4a.toString(sha256(seed), 'hex')
  }

  createProfile(metadata) {
    if (!metadata.content) {
      metadata.content = '{}'
    }
    const parsedContent = JSON.parse(metadata.content)
    let pictureUrl = parsedContent.picture
    let display_name = parsedContent.display_name
    let name = parsedContent.name
    let about = parsedContent.about
    let lud06 = parsedContent.lud06
    let lud16 = parsedContent.lud16

    let title = ''
    if (display_name) { title += `${display_name}` }
    if (name) { title += `\n@${name}` }
    if (!title) { title = this.getNpubFromPub(metadata.pubkey) }
    let description = about || ''
    lud06 = lud06 || ''
    lud16 = lud16 || ''

    return {
      title: title,
      description: description,
      pictureUrl: pictureUrl || '',
      lud06: lud06,
      lud16: lud16
    }
  }

  async init() {
    this.logger.info('init')
    await this.refreshOwn()
    await this.refreshOther()
    setInterval(this.refreshOwn.bind(this), 60000)
    setInterval(this.refreshOther.bind(this), 150000)
    this.logger.info(`secret: ${this.secret}`)
    this.logger.info(`nsec: ${this.nsec}`)
    this.logger.info(`pub: ${this.pub}`)
    this.logger.info(`npub: ${this.npub}`)
    this.logger.info(`metadata: ${JSON.stringify(this.metadata)}`)
    this.logger.info(`profile: ${JSON.stringify(this.profile)}`)
    this.logger.info(`relayList: ${JSON.stringify(this.relayList.list)}`)
    this.logger.info(`muteList: ${this.muteList.list.length} pubs`)
    this.logger.info(
      `followList: ${Array.from(this.followList.map.keys()).length} pubs`
    )
  }

  async close() {
    clearInterval(this.refreshOwn.bind(this))
    clearInterval(this.refreshOther.bind(this))
    this.removeAllListeners()
    this.logger.info('closed')
  }

  async onKindOwn0(e) {
    if (e.created_at > this.metadata.created_at) {
      this.logger.info('checking own metadata')
      this.metadata = e
      this.profile = this.createProfile(e)
      const nostrRTCPub = this.getNostrRTCPubfromMetadata(e)
      if (!nostrRTCPub) {
        this.logger.info(
          'own metadata requires update as nostrRTCPub not available'
        )
        const tag = [
          'i',
          'nostrRTC:' + this.nostrRTCPub,
          this.sign(this.nostrRTCPub)
        ]
        const event = {
          kind: 0,
          created_at: Math.floor(Date.now() / 1000),
          content: this.metadata.content,
          tags: this.metadata.tags.concat([tag])
        }
        this.logger.info('updating own metadata')
        await this.publishEvent(event)
        this.logger.info('updated own metadata')
      }
      this.logger.info('own metadata update not required')
      this.emit('handleNostrClientMetadataUpdate', this.metadata)
    }
  }

  onKindOwn3(e) {
    if (e.created_at > this.followList.createdAt) {
      this.logger.info('checking own followList')
      this.followList.createdAt = e.created_at
      e.tags.forEach(function(t) {
        const [ tagLabel, pub, r ] =  t
        if (tagLabel === 'p' && pub) {
          if (!this.followList.map.has(pub)) {
            let relays = []
            if (r) {
              const sanitizedR = this.isWssUrl(r)
              relays = [sanitizedR]
            }
            const user = {
              createdAt: 0,
              pub: pub,
              npub: this.getNpubFromPub(pub),
              nostrRTCPub: '',
              profile: {
                title: this.getNpubFromPub(pub),
                description: '',
                pictureUrl: '',
                lud06: '',
                lud16: ''
              },
              relays: relays
            }
            this.followList.map.set(pub, user)
            return
          }
          const user = this.followList.map.get(pub)
          if (r) {
            const sanitizedR = this.isWssUrl(r)
            if (!user.relays.includes(sanitizedR)) {
              user.relays.push(sanitizedR)
            }
          }
        }
      }.bind(this))

      const ownPubs = Array.from(this.followList.map.keys())
      const eventPubs = e.tags.filter(function(t) {
        const [ tagLabel, pub, r ] =  t
        if (tagLabel === 'p' && pub) {
          return pub
        }
      }).map(function(t) {
        const [ tagLabel, pub, r ] =  t
        return pub
      })
      const pubsToDelete = ownPubs.filter(function(p) {
        return !eventPubs.includes(p)
      })
      pubsToDelete.forEach(function(p) {
        this.followList.map.delete(p)
      }.bind(this))
      this.logger.info('followList updated')
      this.emit(
        'handleNostrClientFollowListUpdate',
        Array.from(this.followList.map.values())
      )
    }
  }

  async onKindOwn10000(e) {
    if (e.created_at > this.muteList.createdAt) {
      this.logger.info('checking own muteList')
      this.muteList.createdAt = e.created_at
      let pubs = []
      e.tags.forEach(function(t) {
        const [ tagLabel, pub ] =  t
        if (tagLabel === 'p' && pub) {
          if (!pubs.includes(pub)) {
            pubs.push(pub)
          }
        }
      }.bind(this))
      if (e.content) {
        const decryptedContent = await nip04.decrypt(
          this.secret,
          this.pub,
          e.content
        )
        const decryptedContentObj = JSON.parse(decryptedContent)
        decryptedContentObj.forEach(function(t) {
          const [ tagLabel, pub ] =  t
          if (tagLabel === 'p' && pub) {
            if (!pubs.includes(pub)) {
              pubs.push(pub)
            }
          }
        }.bind(this))
      }
      this.muteList.list = pubs
      this.logger.info('muteList updated')
      this.emit('handleNostrClientMuteListUpdate', this.muteList.list)
    }
  }

  async onKindOwn10002(e) {
    if (e.created_at > this.relayList.createdAt) {
      this.logger.info('checking own relayList')
      this.relayList.createdAt = e.created_at
      let relays = []
      e.tags.forEach(function(t) {
        const [ tagLabel, r ] =  t
        if (tagLabel === 'r' && r) {
          if (!relays.includes(r)) {
            relays.push(r)
          }
        }
      }.bind(this))
      this.relayList.list = relays
      this.logger.info('relayList updated')
      this.emit('handleNostrClientRelayListUpdate', this.relayList.list)
    }
  }

  onKindOther0(e) {
    const pub = e.pubkey
    const user = this.followList.map.get(pub)
    if (e.created_at > user.createdAt) {
      user.createdAt = e.created_at
      user.nostrRTCPub = this.getNostrRTCPubfromMetadata(e)
      user.profile = this.createProfile(e)
      return
    }
  }

  onKindOther10002(e) {
    const pub = e.pubkey
    let relays = []
    e.tags.forEach(function(t) {
      const [ tagLabel, r, op ] =  t
      if (tagLabel === 'r' && r) {
        const sanitizedR = this.isWssUrl(r)
        if (sanitizedR && !relays.includes(sanitizedR)) {
          relays.push(sanitizedR)
        }
      }
    }.bind(this))
    const user = this.followList.map.get(pub)
    relays.forEach(function(r) {
      if (!user.relays.includes(r)) {
        user.relays.push(r)
      }
    })
  }

  subscribeUntilEose(relays, kinds, pubs, onEvent, onEose=null) {
    return new Promise(async function(resolve, reject) {
      try {
        const pool = new SimplePool()
        let s = pool.subscribeMany(
          relays,
          [
            {
              kinds: kinds,
              authors: pubs,
            },
          ],
          {
            onevent: async function(e) {
              try {
                await onEvent.call(this, e)
              }
              catch(err) {
                reject(err)
              }
            }.bind(this),
            oneose: async function() {
              try {
                if (onEose) {
                  await onEose.call(this)
                }
                s.close()
                resolve()
              }
              catch(err) {
                reject(err)
              }
            }.bind(this),
          }
        )
      }
      catch(err) {
        reject(err)
      }
    }.bind(this))
  }

  subscribeUntilFirstEventSeen(relays, kinds, pubs, onEvent, onEose=null) {
    return new Promise(async function(resolve, reject) {
      try {
        const pool = new SimplePool()
        let s = pool.subscribeMany(
          relays,
          [
            {
              kinds: kinds,
              authors: pubs,
            },
          ],
          {
            onevent: async function(e) {
              try {
                await onEvent.call(this, e)
                resolve()
              }
              catch(err) {
                reject(err)
              }
            }.bind(this),
            oneose: async function() {
              try {
                if (onEose) {
                  await onEose.call(this)
                }
                s.close()
                resolve()
              }
              catch(err) {
                reject(err)
              }
            }.bind(this),
          }
        )
      }
      catch(err) {
        reject(err)
      }
    }.bind(this))
  }

  async refreshOwn() {
    try {
      await this.subscribeUntilEose(
        this.getPreferredRelays(this.pub),
        [0, 3, 10000, 10002],
        [this.pub],
        async function(e) {
          switch(e.kind) {
            case 0:
              await this.onKindOwn0(e)
              break
            case 3:
              this.onKindOwn3(e)
              break
            case 10000:
              await this.onKindOwn10000(e)
              break
            case 10002:
              await this.onKindOwn10002(e)
              break
          }
        }.bind(this),
        async function() {
          if (this.relayList.createdAt === 0) {
            this.logger.info('relayList not received from relays')
            await this.publishOwnRelayList()
            await this.subscribeUntilEose(
              this.getPreferredRelays(this.pub),
              [10002],
              [this.pub],
              this.onKindOwn10002
            )
          }
          if (this.metadata.created_at === 0) {
            this.logger.info('metadata not received from relays')
            await this.publishOwnMetadata()
            await this.subscribeUntilEose(
              this.getPreferredRelays(this.pub),
              [0],
              [this.pub],
              this.onKindOwn0
            )
          }
        }.bind(this)
      )
      this.logger.info('updated user metadata, relays and followList')
    }
    catch(err) {
      this.logger.error(err.message)
    }
  }

  async refreshOther() {
    try {
      const pubs = Array.from(this.followList.map.keys())

      await this.subscribeUntilEose(
        this.getPreferredRelays(this.pub),
        [10002],
        pubs,
        this.onKindOther10002
      )
      this.logger.info('updated followList pubs relays')
      const subs = pubs.map(async function(pub) {
        const user = this.followList.map.get(pub)
          return this.subscribeUntilEose(
            this.getPreferredRelays(pub),
            [0],
            [pub],
            this.onKindOther0,
          )
      }.bind(this))
      await Promise.allSettled(subs)
      this.logger.info('updated followList pubs metadata')

      this.emit(
        'handleNostrClientFollowListUpdate',
        Array.from(this.followList.map.values())
      )
    }
    catch(err) {
      this.logger.error(err.message)
    }
  }

  isWssUrl(r) {
    const pattern = /^(wss:\/\/)/
    if (pattern.test(r)) {
      r = r.replace('wss://', 'http://')
      if (isURL(r)) {
        r = r.replace('http://', 'wss://')
        r = r.replace(/\/+$/, '')
        return r
      }
    }
    return false
  }

  getRandom(arr, qty) {
    if (arr.length <= qty) {
      return arr
    }
    const randomArr = []
    while (randomArr.length < qty) {
      const randIndex = Math.floor(Math.random() * arr.length)
      if (!randomArr.includes(arr[randIndex])) {
        randomArr.push(arr[randIndex])
      }
    }
    return randomArr
  }

  getPreferredRelays(pub) {
    let preferredRelays

    if (pub === this.pub) {
      if (this.relayList.list.length > 0) {
        preferredRelays = this.getRandom(this.relayList.list, MAX_NUM_RELAYS)
      }
    }

    if (!preferredRelays) {
      if (this.followList.map.has(pub)) {
        const user = this.followList.map.get(pub)
        if (user.relays.length > 0) {
          preferredRelays = this.getRandom(user.relays, MAX_NUM_RELAYS)
        }
      }
    }

    if (!preferredRelays) {
      if (this.relayList.list.length > 0) {
        preferredRelays = this.getRandom(this.relayList.list, MAX_NUM_RELAYS)
      }
      else {
        preferredRelays = this.getRandom(DEFAULT_NOSTR_RELAYS, MAX_NUM_RELAYS)
      }
    }
    return preferredRelays
  }

  async addRelay(r) {
    r = this.isWssUrl(r)
    if (r && !this.relayList.list.includes(r)) {
      const tags = this.relayList.list.map(function(r) {
        return ['r', r]
      })
      const event = {
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags.concat([['r', r]])
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`addRelay success: ${r}`)
        await this.subscribeUntilEose(
          this.getPreferredRelays(this.pub),
          [10002],
          [this.pub],
          this.onKindOwn10002
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async removeRelay(r) {
    if (this.relayList.list.includes(r)) {
      const relays = this.relayList.list.filter(function(relay) {
        return relay !== r
      })
      const tags = relays.map(function(r) {
        return ['r', r]
      })
      const event = {
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`removeRelay success: ${r}`)
        await this.subscribeUntilEose(
          this.getPreferredRelays(this.pub),
          [10002],
          [this.pub],
          this.onKindOwn10002
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async mutePub(pub) {
    if (!this.muteList.list.includes(pub)) {
      const tags = this.muteList.list.map(function(p) {
        return ['p', p]
      })
      const event = {
        kind: 10000,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags.concat([['p', pub]])
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`mutePub success: ${pub}`)
        await this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(this.pub),
          [10000],
          [this.pub],
          this.onKindOwn10000
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async unmutePub(pub) {
    if (this.muteList.list.includes(pub)) {
      const pubs = this.muteList.list.filter(function(p) {
        return p !== pub
      })
      const tags = pubs.map(function(p) {
        return ['p', p]
      })
      const event = {
        kind: 10000,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`unmutePub success: ${pub}`)
        await this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(this.pub),
          [10000],
          [this.pub],
          this.onKindOwn10000
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async followPub(pub) {
    const pubs = Array.from(this.followList.map.keys())
    if (!pubs.includes(pub)) {
      const tags = pubs.map(function(p) {
        return ['p', p]
      })
      const event = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags.concat([['p', pub]])
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`followPub success: ${pub}`)
        await this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(this.pub),
          [3],
          [this.pub],
          this.onKindOwn3
        )
        this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(this.pub),
          [10002],
          [pub],
          function(e) {
            this.onKindOther10002(e)
            this.emit(
              'handleNostrClientFollowListUpdate',
              Array.from(this.followList.map.values())
            )
          }
        )
        this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(pub),
          [0],
          [pub],
          function(e) {
            this.onKindOther0(e)
            this.emit(
              'handleNostrClientFollowListUpdate',
              Array.from(this.followList.map.values())
            )
          }
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async unfollowPub(pub) {
    const pubs = Array.from(this.followList.map.keys())
    if (pubs.includes(pub)) {
      const newPubs = pubs.filter(function(p) {
        return p !== pub
      })
      const tags = newPubs.map(function(p) {
        return ['p', p]
      })
      const event = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: tags
      }
      try {
        await this.publishEvent(event)
        this.logger.info(`unfollowPub success: ${pub}`)
        await this.subscribeUntilFirstEventSeen(
          this.getPreferredRelays(this.pub),
          [3],
          [this.pub],
          this.onKindOwn3
        )
        return true
      }
      catch(err) {
        return false
      }
    }
    return false
  }

  async publishOwnMetadata() {
    const tag = [
      'i',
      'nostrRTC:' + this.nostrRTCPub,
      this.sign(this.nostrRTCPub)
    ]
    const event = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify({}),
      tags: [tag]
    }
    try {
      this.logger.info('publishing own metadata')
      await this.publishEvent(event)
      this.logger.info('published own metadata')
    }
    catch(err) {
      return
    }
  }

  async publishOwnRelayList() {
    const relays = []
    while (relays.length < MAX_NUM_RELAYS) {
      const randIndex = Math.floor(Math.random() * DEFAULT_NOSTR_RELAYS.length)
      const randR = DEFAULT_NOSTR_RELAYS[randIndex]
      if (!relays.includes(randR)) {
        relays.push(randR)
      }
    }
    const tags = relays.map(function(r) {
      return ['r', r]
    })
    const event = {
      kind: 10002,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: tags
    }
    try {
      this.logger.info('publishing own relayList')
      await this.publishEvent(event)
      this.logger.info('published own relayList')
    }
    catch(err) {
      return
    }
  }

  async publishEvent(event, useRelays=[]) {
    const signedEvent = finalizeEvent(event, Buffer.from(this.secret, 'hex'))
    let relays
    if (useRelays.length > 0) {
      relays = this.getRandom(useRelays, MAX_NUM_RELAYS)
    }
    else {
      relays = this.getPreferredRelays(signedEvent.pubkey)
    }
    const pool = new SimplePool()
    try {
      await Promise.any(pool.publish(relays, signedEvent))
      try {pool.close(relays)}
      catch(err) {}
    }
    catch(err) {
      this.logger.error(err.message)
      throw err
    }
  }

  isNwc(query) {
    try {
      const result = webln.NostrWebLNProvider.parseWalletConnectUrl(query)
      if (result.walletPubkey && result.secret && result.relayUrl ) {
        return true
      }
      return false
    }
    catch(err) {
      return false
    }
  }

  isNsec(query) {
    try {
      const { type, data } = nip19.decode(query)
      if (type === 'nsec') {
        return b4a.toString(data, 'hex')
      }
    }
    catch(err) {
      return false
    }
  }

  isNpub(query) {
    try {
      const { type, data } = nip19.decode(query)
      if (type === 'npub') {
        return data
      }
      return false
    }
    catch(err) {
      return false
    }
  }

  isNprofile(query) {
    try {
      const relays = []
      const { type, data } = nip19.decode(query)
      if (type === 'nprofile') {
        if (data.relays) {
          data.relays.forEach(function(r) {
            const sanitizedR = this.isWssUrl(r)
            if (sanitizedR && !relays.includes(sanitizedR)) {
              relays.push(sanitizedR)
            }
          }.bind(this))
        }
        return {
          pub: data.pubkey,
          relays: relays
        }
      }
      return false
    }
    catch(err) {
      return false
    }
  }

  getRelaysFromNprofile(query) {

    try {
      const relays = []
      const { type, data } = nip19.decode(query)
      if (type === 'nprofile') {

      }
      return relays
    }
    catch(err) {
      return []
    }
  }

  getNpubFromNsec(query) {
    try {
      const nsecDecoded = this.isNsec(query)
      if (nsecDecoded) {
        const pub = getPublicKey(nsecDecoded)
        const npub = nip19.npubEncode(pub)
        return npub
      }
      return false
    }
    catch(err) {
      return false
    }
  }

  getNpubFromPub(query) {
    return nip19.npubEncode(query)
  }

  async getPubkeyFromNip05(query) {
    try {
      const relays = []
      const profile = await nip05.queryProfile(query)
      if (profile) {
        if (profile.relays) {
          profile.relays.forEach(function(r) {
            const sanitizedR = this.isWssUrl(r)
            if (sanitizedR && !relays.includes(sanitizedR)) {
              relays.push(sanitizedR)
            }
          }.bind(this))
        }
        return {
          pub: profile.pubkey,
          relays: relays
        }
      }
      return false
    }
    catch(err) {
      return false
    }
  }

  getNostrRTCPubfromMetadata(metadata) {
    const matchedTags = metadata.tags.filter(function(t) {
      const [ tagId, platformIdentity, proof ] = t
      const platformIdentitySplit = platformIdentity.split(':')
      const platform = platformIdentitySplit[0]
      const identity = platformIdentitySplit[1]
      return (
        tagId === 'i' &&
        platform === 'nostrRTC' &&
        this.verify(proof, identity, metadata.pubkey)
      )
    }.bind(this))
    if (matchedTags.length > 0) {
      return matchedTags[0][1].split(':')[1]
    }
    return ''
  }

  getOwnUser() {
    return {
      secret: this.secret,
      nsec: this.nsec,
      pub: this.pub,
      npub: this.npub,
      nostrRTCPub: this.nostrRTCPub,
      profile: this.profile,
      relayList: this.relayList.list,
      muteList: this.muteList.list,
      followList: Array.from(this.followList.map.values()),
      nwc: this.nwc
    }
  }

  async getUser(query) {
    const user = {}
    let useRelays
    this.logger.info(`getUser query: ${query}`)
    try {
      if (isEmail(query) || isFQDN(query)) {
        const profile  = await this.getPubkeyFromNip05(query)
        if (profile) {
          user.pub = profile.pub
          if (profile.relays.length > 0) {
            useRelays = profile.relays
          }
        }
      }
      else if (isHexadecimal(query) && query.length === 64) {
        user.pub = query
      }
      else if (this.isNpub(query)) {
        user.pub = this.isNpub(query)
      }
      else if (this.isNprofile(query)) {
        const profile = this.isNprofile(query)
        if (profile) {
          user.pub = profile.pub
          if (profile.relays.length > 0) {
            useRelays = profile.relays
          }
        }
      }
      else {
        if (query.length >= 3) {
          const matched = Array.from(this.followList.map.values())
            .filter(function(u) {
              return u.profile.title.toLowerCase()
                .includes(query.toLowerCase())
            })
          if (matched.length > 0) {
            const cachedUser = matched[0]
            const preferredRelays = this.getPreferredRelays(cachedUser.pub)
            this.logger.info(
              `attempting update with relays: ${JSON.stringify(preferredRelays)}`
            )
            this.subscribeUntilEose(
              preferredRelays,
              [0],
              [cachedUser.pub],
              this.onKindOther0
            )
            this.emit(
              'handleNostrClientFollowListUpdate',
              Array.from(this.followList.map.values())
            )
            this.logger.info(`getUser[cached] result: ${JSON.stringify(cachedUser)}`)
            return cachedUser
          }
        }
        return null
      }

      if (user.pub) {
        if (this.followList.map.has(user.pub)) {
          const preferredRelays = this.getPreferredRelays(user.pub)
          this.logger.info(
            `attempting update with relays: ${JSON.stringify(preferredRelays)}`
          )
          this.subscribeUntilEose(
            preferredRelays,
            [0],
            [user.pub],
            this.onKindOther0
          )
          this.emit(
            'handleNostrClientFollowListUpdate',
            Array.from(this.followList.map.values())
          )
          const cachedUser = this.followList.map.get(user.pub)
          this.logger.info(`getUser[cached] result: ${JSON.stringify(cachedUser)}`)
          return cachedUser
        }
        user.npub = nip19.npubEncode(user.pub)
        if (!useRelays) {
          useRelays = this.getPreferredRelays(this.pub)
        }
        this.logger.info(
          `attempting fetch with relays: ${JSON.stringify(useRelays)}`
        )
        const pool = new SimplePool()
        const e = await pool.get(
          useRelays,
          {
            kinds: [0],
            authors: [user.pub]
          }
        )
        if (e) {
          user.profile = this.createProfile(e)
          user.nostrRTCPub = this.getNostrRTCPubfromMetadata(e)
        }
        else {
          user.nostrRTCPub = ''
          user.profile = {
            title: user.npub,
            description: '',
            pictureUrl: ''
          }
        }
        this.logger.info(`getUser[fetched] result: ${JSON.stringify(user)}`)
        return user
      }
      this.logger.info('getUser result: none')
      return null
    }
    catch(err) {
      this.logger.error(err.message)
      this.logger.info('getUser result: none')
      return null
    }
  }

  async getZapParams(zapAddress) {
    try {
      this.logger.info(`getZapParams for: ${zapAddress}`)
      let query = zapAddress
      if (isEmail(zapAddress)) {
        const emailSplit = query.split('@')
        const username = emailSplit[0]
        const domain = emailSplit[1]
        query = `https://${domain}/.well-known/lnurlp/${username}`
      }
      const params = await getParams(query)
      if (
        !params.tag ||
        params.tag !== 'payRequest' ||
        !params.callback ||
        !isURL(params.callback) ||
        !params.minSendable ||
        !params.maxSendable
      ) {
        throw new Error('invalid lnurl')
      }
      this.logger.info(`zapParams: ${JSON.stringify(params)}`)
      return params
    }
    catch (err) {
      this.logger.error(err.message)
      return null
    }
  }

  async getZapInvoice(params) {
    try {
      const { callbackUrl, amount } = params
      this.logger.info(`getZapInvoice - url: ${callbackUrl} - amount: ${amount}`)
      let r = await fetch(`${callbackUrl}?amount=${amount}`)
      if (r.status >= 300) {
        throw new Error(await r.text())
      }
      const res = await r.json()
      if (!res.pr) {
        throw new Error('invalid lnurl response: requestInvoice')
      }
      this.logger.info(`zapInvoice: ${res.pr}`)
      return res.pr
    }
    catch(err) {
      this.logger.error(err.message)
      return null
    }
  }

  async zap(invoice) {
    try {
      if (!invoice) {
        this.logger.error('invoice is required')
        return null
      }
      if (!this.nwc) {
        this.logger.warn('nostrWalletConnectUrl is required!')
        return null
      }
      this.logger.info(`zapping invoice: ${invoice}`)
      const weblnZap = new webln.NostrWebLNProvider({
        nostrWalletConnectUrl: this.nwc
      })
      await weblnZap.enable()
      const response = await weblnZap.sendPayment(invoice)
      weblnZap.close()
      this.logger.info(
        `zapping invoice success - preimage: ${response.preimage}`
      )
      return response.preimage
    }
    catch(err) {
      const { error, code } = err
      if (error) {
        this.logger.error(error)
      }
      else {
        this.logger.error(err.message)
      }
      return null
    }
  }
}

module.exports = NostrClient
