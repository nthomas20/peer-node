'use strict'

/**
 * Host, Peer, Node definitions
 * @author Nathaniel Thomas <nthomas20@gmail.com>
 * @module peer-node
 */

const crypto = require('crypto')
const keypair = require('keypair')
const net = require('net')
const PromiseSocket = require('promise-socket')
const EventEmitter = require('events')

/**
 * Host identifier. Supports IPV4 and IPV6 and contains family, address, and port
 * @class
 * @memberof module:peer-node
 */
class Host {
  /**
   * @constructor
   * @param {String} address - IPV4 or IPv6 based address. "localhost" is translated to 127.0.0.1
   * @param {Number} port - Port number on which to identify the host
   * @returns {Object} Host Instance
   */
  constructor (address, port = 5744) {
    // Accept a few shortcuts for local host
    if (address.includes(['localhost'])) {
      address = '127.0.0.1'
    }

    let version = net.isIP(address)

    // Check family
    if (version === 0) {
      throw new Error('Unknown address family')
    } else {
      this._family = `IPv${version}`
    }

    this._address = address
    this._port = port
  }

  /**
   * Get the host address
   * @returns Address String
   */
  get address () {
    return this._address
  }

  /**
   * Get the host port
   * @returns Port Number
   */
  get port () {
    return this._port
  }

  /**
   * Get the family type of address
   * @returns IPVv or IPv6
   */
  get family () {
    return this._family
  }

  /**
   * Get the object summary of this host instance
   * @returns Object containing address, family, and port of the host
   */
  get object () {
    return {
      address: this.address,
      family: this.family,
      port: this.port
    }
  }
}

/**
 * Peer Object can reach out and connect to a host Node and is used inside Host to identify connected Peers
 * @class
 * @memberof module:peer-node
 */
class Peer {
  /**
   * @constructor
   * @param {Host} Host object identifying the connection
   * @param {Number} [header=0xA27CC1A2] - 10 digit number identifying header of each message
   * @param {Number} [bufferSize=10485760] - Size of the buffer used to process incoming messages
   * @param {Number} [maxConnectionAttempts=10] - How many times the Peer should attempt to connect before giving up
   * @returns Peer Instance
   */
  constructor (host, header = 0xA27CC1A2, bufferSize = 10485760, maxConnectionAttemps = 10) {
    this._host = host
    this._state = null
    this._header = header
    this._bufferSize = bufferSize
    this._socket = null
    this._hash = null
    this._connectionAttempts = 0
    this._keypair = null
    this._remotePublicKey = null
    this._maxConnectionAttempts = maxConnectionAttemps

    this._eventEmitter = new EventEmitter()
  }

  _calculateChecksum (command, data = null) {
    return crypto.createHmac('sha256', command).update(data).digest('hex')
  }

  _socketEventConnect () {
    this._state = 'connected'
    this._connectionAttempts = 0
    this._eventEmitter.emit('connect', {
      peer: this
    })
  }

  _socketEventData (data) {
    // Add data to incoming buffer
    if (data.length + this._inCursor > this._inBuffer.length) {
      this._eventEmitter.emit('error', { peer: this, 'err': 'Peer exceeded max receiving buffer' })
      this._inCursor = this._inBuffer.length + 1
      return
    }

    data.copy(this._inBuffer, this._inCursor)
    this._inCursor += data.length

    // Only process incoming buffer when we have 20 bytes or more
    if (this._inCursor < 20) return

    // Split on header to sparate messages
    let cursor = 0
    let messageEnd = 0

    while (cursor < this._inCursor) {
      // Look for start of a message
      if (this._inBuffer.readUInt32LE(cursor) === this._header) {
        let messageStart = cursor
        if (this._inCursor > messageStart + 16) {
          let messageLength = this._inBuffer.readUInt32LE(messageStart + 16)

          if (this._inCursor >= messageStart + messageLength + 24) {
            // Complete message, let's parse it
            this._processMessage(this._inBuffer.slice(messageStart, messageStart + messageLength + 24))
            messageEnd = messageStart + messageLength + 24
          }
          // Move to the next message
          cursor += messageLength + 24
        } else {
          // Move to the end of processable data
          cursor = this._inCursor
        }
      } else {
        cursor++
      }
    }

    // Remove processed message from the buffer
    if (messageEnd > 0) {
      this._inBuffer.copy(this._inBuffer, 0, messageEnd, this._inCursor)
      this._inCursor -= messageEnd
    }
  }

  _socketEventEnd () {
    this._eventEmitter.emit('end', { peer: this })
  }

  _socketEventError (err) {
    if (this.state === 'connecting') {
      this._connectionAttempts++

      // Reset the socket to try again
      this._socket = null

      this.connect()
    }

    if (this.state !== 'connecting' || this._connectionAttempts >= this._maxConnectionAttemps) {
      this._eventEmitter.emit('error', { peer: this, err: err })
    }
  }

  _socketEventClose (err) {
    this._state = 'closed'
    this._eventEmitter.emit('close', { peer: this, err: err })
  }

  /**
   * Connect to the host peer. Fires the 'connect' event on success (of new connection only)
   * @param {Socket} [socket=null] - Pass in an already connected socket or the default will make a fresh connection
   * @returns {Socket} Socket reference stored in the Peer
   */
  async connect (socket = null) {
    this._inBuffer = Buffer.alloc(this._bufferSize)
    this._inCursor = 0

    if (this._socket === null) {
      if (socket === null) {
        this._state = 'connecting'
        socket = net.createConnection(this._host.port, this._host.address, this._socketEventConnect.bind(this))
      } else {
        this._state = 'connected'
      }

      socket.on('data', this._socketEventData.bind(this))
      socket.on('error', this._socketEventError.bind(this))

      this._socket = new PromiseSocket(socket)

      // If we have a keypair, then let's negotiate
      if (this.keypair !== null) {
        await this.send('SECURE', this.keypair.public)
      }
    }

    return this._socket
  }

  /**
   * Get the number of connection attempts made
   */
  get connectionAttempts () {
    return this._connectionAttempts
  }

  /**
   * Disconnect from the Peer. Fires the 'close' event on success
   */
  async disconnect () {
    this._state = 'disconnecting'
    await this._socket.end()
    this._socketEventClose()
  }

  /**
   * Destroy the Peer connection. Fires the 'close' event on success
   */
  async destroy () {
    this._state = 'destroying'
    await this._socket.destroy()
    this._socketEventClose()
  }

  /**
   * Generate a key pair for this Peer communication. This must occur prior to connecting to the Peer
   */
  generateKeypair () {
    if (this.state === null) {
      this._keypair = keypair()
    } else {
      throw new Error('Cannot generate keypair after connection')
    }
  }

  /**
   * Get this Peer's hash value
   */
  get hash () {
    return this._hash
  }

  /**
   * Set the has value of this Peer
   */
  set hash (hash) {
    this._hash = hash
  }

  /**
   * Get the key pair for this side of the Peer connection
   */
  get keypair () {
    return this._keypair
  }

  /**
   * Get the remote public key for this Peer connection
   */
  get remotePublicKey () {
    return this._remotePublicKey
  }

  _processMessage (message) {
    let messageLength = message.readUInt32LE(16)

    // Get command
    let command = []
    for (let i = 0; i < 12; i++) {
      let s = message[i + 4]
      if (s > 0) {
        command.push(String.fromCharCode(s))
      }
    }
    command = command.join('')

    let checksum = message.readUInt32BE(20)
    let payload

    if (messageLength > 0) {
      payload = Buffer.alloc(messageLength)
      message.copy(payload, 0, 24)
      let checksumVerification = Buffer.from(this._calculateChecksum(command, payload))

      // Check the checksum for verification
      if (checksum !== checksumVerification.readUInt32BE(0)) {
        // Do not process a valid message
        payload = null
      }
    } else {
      payload = Buffer.alloc(0)
    }

    if (payload !== null) {
      // If our command is SECURE, then do not send an event and manage the remote public key here
      if (command === 'SECURE') {
        this._remotePublicKey = payload.toString()
      } else {
        // Do we need to decrypt the payload?
        if (this._remotePublicKey !== null) {
          payload = crypto.publicDecrypt(this._remotePublicKey, payload)
        }

        this._eventEmitter.emit('message', {
          peer: this,
          command: command,
          data: payload
        })
      }
    }
  }

  /**
   * Attach to a peer event
   * @param {String} event - Event string on which to attach
   * @param {Function} callback - Function to execute when event is emitted
   */
  on (event, callback) {
    this._eventEmitter.on(event, callback)
  }

  /**
   * Send a command and data packet to the connected Peer
   * @param {String} command - Maximum 12 characters command string
   * @param {String} [data=null] - Data string to send to the connected Peer
   * @returns {Boolean} Success state of sending the data packet
   */
  async send (command, data = null) {
    if (data === null) {
      data = Buffer.alloc(0)
    } else {
      data = Buffer.from(data)
    }

    // If we're not sending public key and we have a private key and remote public key, then encrypt the data
    if (command !== 'SECURE' && this.keypair !== null && this._remotePublicKey !== null) {
      data = crypto.privateEncrypt(this.keypair.private, data)
    }

    // Allocate buffer length of data + command/checksum byte length
    let outgoingBuffer = Buffer.alloc(data.length + 24)

    // Write the message header to start this message
    outgoingBuffer.writeUInt32LE(this._header, 0)

    // Loop through our command characters and write up to 12 of them
    for (let i = 0; i < 12; i++) {
      // Add the command character
      if (i < command.length) {
        outgoingBuffer.writeUInt8(command.charCodeAt(i), i + 4)
      }
    }

    // Output the length of the data block
    outgoingBuffer.writeUInt32LE(data.length, 16)

    // Generate our checksum for this message
    let checksum = Buffer.from(this._calculateChecksum(command, data))

    // Copy our checksum and data into the outgoing buffer
    checksum.copy(outgoingBuffer, 20)
    data.copy(outgoingBuffer, 24)

    try {
      await this._socket.write(outgoingBuffer, null)

      return true
    } catch (err) {
      return false
    }
  }

  /**
   * Get the state of this Peer connection
   */
  get state () {
    return this._state
  }
}

/**
 * Peer Node Server. This is needed to allow other peers to connect into the system network
 * @class
 * @memberof module:peer-node
 */
class Node {
  /**
   * @constructor
   * @param {Host} Host object identifying the connection (Only port is utilized)
   * @param {Number} [header=0xA27CC1A2] - 10 digit number identifying header of each message
   * @param {Number} [bufferSize=10485760] - Size of the buffer used to process incoming messages
   * @returns Node Instance
   */
  constructor (host, header = 0xA27CC1A2, bufferSize = 10485760) {
    this._host = host
    this._header = header
    this._bufferSize = bufferSize

    this._server = null

    this._keypair = keypair()

    this._peerList = {}

    this._eventEmitter = new EventEmitter()
  }

  /**
   * Connect this Host Node to a peer
   * @param {Socket|Peer} socketOrPeer - Add connected peer either via direct socket or already connected Peer object
   * @returns {Boolean} Success of connection
   */
  connectPeer (socketOrPeer) {
    // Here is the processing for when a connection is made in
    let peer
    let remoteHost

    if (socketOrPeer instanceof Peer) {
      peer = socketOrPeer
      remoteHost = peer._host.object
    } else {
      let socket = socketOrPeer
      remoteHost = socket.address()
      peer = new Peer(new Host(remoteHost.address, remoteHost.port))
      peer._keypair = this._keypair
      peer.connect(socket)
    }

    peer.hash = crypto.createHash('md5').update((new Date() / 1).toString()).digest('hex')

    this._peerList[peer.hash] = peer

    peer.on('message', (data) => {
      // Forward this peer's message on to the Node server itself and its listeners
      this._eventEmitter.emit('message', data)
    })

    peer.on('end', () => {
      // Just delete the peer connection, it will reconnect if it wants to
      delete this._peerList[peer.hash]
      this._eventEmitter.emit('end', {
        peer: peer
      })
    })

    peer.on('error', () => {
      // Just delete the peer connection, it will reconnect if it wants to
      delete this._peerList[peer.hash]
      this._eventEmitter.emit('error', {
        peer: peer
      })
    })

    this._eventEmitter.emit('peerConnected', {
      peer: peer,
      peerHash: peer.hash,
      remoteHost: remoteHost
    })
  }

  /**
   * Broadcast data packets to all connected peers
   * @param {String} command - Maximum 12 character command string
   * @param {String} data - String to broadcast
   */
  broadcast (command, data) {
    if (Object.keys(this._peerList).length > 0) {
      for (let peerHash in this._peerList) {
        this._peerList[peerHash].send(command, data)
      }
    }
  }

  /**
   * Get the keypair for this Node
   */
  get keypair () {
    return this._keypair
  }

  /**
   * Start the Peer Node service and listen for incoming Peer connections. Fires 'nodeListening' event on success
   */
  listen () {
    this._state = 'connecting'
    this._inBuffer = Buffer.alloc(this._bufferSize)
    this._inCursor = 0

    if (this._server === null) {
      this._server = net.createServer(this.connectPeer.bind(this))

      this._server.listen(this._host.port, () => {
        // Emit an event saying that the node is listening, #magic
        this._eventEmitter.emit('nodeListening')
      })
    }
  }

  /**
   * Attach to a peer event
   * @param {String} event - Event string on which to attach
   * @param {Function} callback - Function to execute when event is emitted
   */
  on (event, callback) {
    this._eventEmitter.on(event, callback)
  }

  /**
   * Get the Peer Node connection port
   */
  get port () {
    return this._host._port
  }
}

exports.Host = Host
exports.Peer = Peer
exports.Node = Node
