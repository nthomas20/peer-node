# peer-node
Peer Node for constructing p2p networks. Supports RSA keypair encryption of data payload

# Launch a Peer Node

If a Peer wishes to accept connections, it must run its own Peer Node Server. Here's a simple server that will accept incoming connections and every 10 seconds broadcast a message to all connected peers.

```js
'use strict'

const p2p = require('peer-node')
const {promisify} = require('util')

async function run () {
  let Node = new p2p.Node(new p2p.Host('localhost', 3000))

  Node.on('peerConnected', (data) => {
    console.log(`Peer connected: hash = ${data.peerHash}`)
  })

  setTimeout(() => {
    console.log('sending broadcast')
    Node.broadcast('HOWDY', 'I wish to bid you welcome! All are welcome here!')
  }, 10000)

  await Node.listen()
}

let runAsync = promisify(run)

runAsync()
```

# Launch an outgoing Peer Connection

Remote systems can connect without hosting their own incoming server. If you launch the previous script in one terminal and run the following script in one or more terminals, you will see the communications

```js
'use strict'

const p2p = require('peer-node')
const {promisify} = require('util')

async function run () {
  let Peer = new p2p.Peer(new p2p.Host('127.0.0.1', 3000))

  // This will secure communications between nodes
  Peer.generateKeypair()

  Peer.on('connect', () => {
    console.log('CONNECTED TO HOST! HUZZAH!!')
  })

  Peer.on('message', (payload) => {
    // Output the message payload that was broadcast
    console.log(payload.data.toString())
  })

  await Peer.connect()
}

let runAsync = promisify(run)

runAsync()

```