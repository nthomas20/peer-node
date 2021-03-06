'use strict'

const p2p = require('../src/index')
const { promisify } = require('util')

async function run () {
  const Node = new p2p.Node(new p2p.Host('localhost', 3000))

  Node.on('peerConnected', (data) => {
    console.log('Peer connected', data.peerHash)
  })

  setInterval(() => {
    console.log('sending broadcast')
    Node.broadcast('NOM', 'I wish to allocate you 300 noms, everybody gets 300 noms!!!')
  }, 10000)

  await Node.listen()
}

const runAsync = promisify(run)

runAsync()
