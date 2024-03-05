/* global describe beforeEach it afterEach */

'use strict'

/**
 * Testing for the Peer Node Network
 * @author Nathaniel Thomas
 */

// console.log('Run p2node.js in one terminal')
// console.log('...then run p2peer.js one or more times in additional terminals')
// console.log('...within 10 seconds the p2node will send encrypted broadcasts to all connected p2peers')

const peerNode = require('../src/index')
const chai = require('chai')

chai.should()

describe('Host Tests', () => {
  it('should identify IPv4 Host Address', () => {
    const host = new peerNode.Host('10.1.1.1')

    host.family.should.equal('IPv4')
  })
  it('should identify special \'localhost\' Address', () => {
    const host = new peerNode.Host('localhost')

    host.family.should.equal('IPv4')
  })
  it('should identify Full IPv6 Host Address', () => {
    const host = new peerNode.Host('2607:f0d0:1002:0051:0000:0000:0000:0004')

    host.family.should.equal('IPv6')
  })
  it('should throw error for Invalid Host Address', () => {
    try {
      const host = new peerNode.Host('hoobleedooble')

      host.family.should.equal('unknown')
    } catch (e) {
      return true
    }
  })
})

// https://stackoverflow.com/questions/15509231/unit-testing-node-js-and-websockets-socket-io
describe('Peer to Host Tests', () => {
  let node
  const testHost = new peerNode.Host('localhost', 3000)

  beforeEach(() => {
    node = new peerNode.Node(testHost)

    node.listen()
  })

  it('should generate keypair and connect successfully to the test Node', (done) => {
    const peer = new peerNode.Peer(testHost)

    peer.generateKeypair()

    peer.on('connect', async () => {
      await peer.disconnect()
      done()
    })

    peer.connect()
  })

  it('should send a message to the test Node', (done) => {
    const peer = new peerNode.Peer(testHost)

    peer.on('connect', async () => {
      await peer.send('TEST', 'This is my test data!')
    })

    node.on('message', async (payload) => {
      await peer.disconnect()
      done()
    })

    peer.connect()
  })

  it('should receive a message from the test Node', (done) => {
    const peer = new peerNode.Peer(testHost)

    peer.generateKeypair()

    peer.on('message', async (payload) => {
      payload.data.should.equal('Here is your test message')
      // console.log(data)
      await peer.disconnect()
      done()
    })

    peer.on('connect', async () => {
      node.broadcast('TEST', 'Here is your test message')
    })

    peer.connect()
  })

  afterEach(async () => {
    await node.stop()
  })
})
