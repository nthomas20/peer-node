/* global describe it */

'use strict'

/**
 * Testing for the Peer Node Network
 * @author Nathaniel Thomas <nthomas20@gmail.com>
 */

// console.log('Run p2node.js in one terminal')
// console.log('...then run p2peer.js one or more times in additional terminals')
// console.log('...within 10 seconds the p2node will send encrypted broadcasts to all connected p2peers')

const peerNode = require('../src/index')
const chai = require('chai')

chai.should()

describe('Peer Node Tests', () => {
  it(`should identify IPv4 Host Address`, () => {
    let host = new peerNode.Host('10.1.1.1')

    host.family.should.equal('IPv4')
  })
  it(`should identify special 'localhost' Address`, () => {
    let host = new peerNode.Host('localhost')

    host.family.should.equal('IPv4')
  })
  it(`should identify Full IPv6 Host Address`, () => {
    let host = new peerNode.Host('2607:f0d0:1002:0051:0000:0000:0000:0004')

    host.family.should.equal('IPv6')
  })
  it(`should throw error for Invalid Host Address`, () => {
    try {
      let host = new peerNode.Host('hoobleedooble')

      host.family.should.equal('unknown')
    } catch (e) {
      return true
    }
  })
})