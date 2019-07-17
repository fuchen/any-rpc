import {rpc, exported, rpcServe, getServiceProxy } from '../src'
import * as socketIo from 'socket.io'

@rpc()
class ServerSideService {
  constructor(private readonly clientProxy) {}

  @exported
  add(a, b) {
    console.log('add', a, b)
    return a + b
  }

  @exported
  addAsync(a, b) {
    console.log('addAsync', a, b)
    return new Promise((resolve) => {
      setTimeout(() => resolve(a + b), 1000)
    })
  }

  @exported
  throwError() {
    console.log('throwError')
    throw new Error('expected error')
  }

  @exported
  async callClientMul() {
    console.log('callClientMul')
    console.log('3 * 7 = ', await this.clientProxy.mul(3, 7))
  }

  // @exported: not exported
  sub(a, b) {
    console.log('sub', a, b)
    return a - b
  }
}

const io = socketIo(3333)

io.on('connect', socket => {
  const clientProxy = getServiceProxy(socket, 'ClientSideService')
  rpcServe(socket, new ServerSideService(clientProxy))
})

console.log('listening on 3333')
