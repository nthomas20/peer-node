'use strict'

const p2p = require('../src/index')

// Switch around the local and remote hosts for second process connection
let LocalHost = new p2p.Host(`127.0.0.1`, 6000)
let RemoteHost = new p2p.Host(`127.0.0.1`, 3000)
let Node = new p2p.Node(LocalHost)
let Peer = new p2p.Peer(RemoteHost)

Node.on(
  `peerConnected`,
  data => {
    console.log(`Peer connected: hash = ${data.peerHash}, ${data.remoteHost.port}`)
  }
)

Node.on(
  `nodeListening`,
  data => {
    Node.connectPeer(Peer)
  }
)

Peer.generateKeypair() // This will secure communications between nodes

Peer.on(
  `connect`,
  () => console.log(`Connected to the host! Huzzah!!`)
)

Peer.on(
  `message`,
  payload => {
    console.log(payload.data.toString())

    // Pass it forward
    Node.broadcast(payload.command, payload.data)
  }
)

Peer.on('end', (data) => {
  console.log('end', data)
})

Peer.on('error', (data) => {
  console.log('error', data)
})

Peer.connect()

Node.listen()
