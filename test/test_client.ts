import * as socketIoClient from 'socket.io-client'
import {rpc, exported, rpcServe, getServiceProxy } from '../src'

@rpc()
class ClientSideService {
  @exported
  mul(a: number, b: number) {
    console.log('mul', a, b)
    return a * b
  }
}

const socket = socketIoClient.connect('ws://localhost:3333')

socket.on('connect', async () => {
  rpcServe(socket, new ClientSideService())
  const service = getServiceProxy(socket, 'ServerSideService')
  console.log(await service.add.invoke(1, 2))
  console.log(await service.addAsync.invoke(1, 2))

  try {
    await service.throwError.invoke()
  } catch (e) {
    console.log(e.toString())
  }

  try {
    await service.sub.invoke(1, 2)
  } catch (e) {
    console.log(e.toString())
  }

  await service.callClientMul.invoke()
})
