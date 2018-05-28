# peer-node
Peer Node for constructing p2p networks. Supports RSA keypair encryption of data payload

# Install

## Using yarn
```bash
yarn add peer-node
```

## Using npm
```bash
npm install peer-node
```

# Documentation

Clone the master branch from github

```bash
git clone https://github.com/nthomas20/peer-node.git
```

Navigate to the repository directory and run the following (You may also replace `yarn` with `npm`):

```bash
yarn install; yarn jsdocs
```

Then simply open up a web browser and navigate to: `localhost:8080` to view the documentation


# Launch a Peer Node

If a Peer wishes to accept connections, it must run its own Peer Node Server. Here's a simple server that will accept incoming connections and every 10 seconds broadcast a message to all connected peers.

```js
'use strict'

const p2p = require('peer-node')

let Host = new p2p.Host(`127.0.0.1`, 3000)
let Node = new p2p.Node(Host)

Node.on(
  `peerConnected`,
  data => console.log(`Peer connected: hash = ${data.peerHash}`)
)

setInterval(
  () => {
    console.log(`sending broadcast`)
    Node.broadcast(`HOWDY`, `I wish to bid you welcome! All are welcome here!`)
  },
  10000
)

Node.listen()
```

# Launch an outgoing Peer Connection

Remote systems can connect without hosting their own incoming server. If you launch the previous script in one terminal and run the following script in one or more terminals, you will see the communications

```js
'use strict'

const p2p = require('peer-node')

let Host = new p2p.Host(`127.0.0.1`, 3000)
let Peer = new p2p.Peer(Host)

Peer.generateKeypair() // This will secure communications between nodes

Peer.on(
  `connect`,
  () => console.log(`Connected to the host! Huzzah!!`)
)

Peer.on(
  `message`,
  payload => console.log(payload.data.toString()) // Output the message payload that was broadcast
)

Peer.connect()
```