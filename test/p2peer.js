'use strict'

const p2p = require('../src/index')
const { promisify } = require('util')

async function run () {
  const Peer = new p2p.Peer(new p2p.Host('127.0.0.1', 3000))

  Peer.generateKeypair()

  Peer.on('connect', () => {
    console.log('CONNECTED!')
  })

  Peer.on('message', (payload) => {
    console.log(payload.command, ':', payload.data.toString())
  })

  await Peer.connect()
}

const runAsync = promisify(run)

runAsync()
