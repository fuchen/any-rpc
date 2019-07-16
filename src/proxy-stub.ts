import 'reflect-metadata'
import {Transporter} from './common'

const rpcProxiesMetadataKey = Symbol('any-rpc:proxies')

class ServiceProxyHandler {
  // tslint:disable-next-line: ban-types
  private methodStubs = new Map<string, Function>()
  private seq = 1
  private pendingRpcs = new Map<number, {
    resolve: (value: any) => void
    reject: (error: any) => void
  }>()

  constructor(private readonly transporter: Transporter, private readonly ns: string) {
  }

  // tslint:disable-next-line: ban-types
  public get(target: any, method: string): Function {
    let func = this.methodStubs.get(method)
    if (func) {
      return func
    }

    func = (...params: any[]) => new Promise((resolve, reject) => {
      const seq = this.seq++
      this.transporter.emit('__rpc_call__', {
        ns: this.ns, seq, method, params
      })
      this.pendingRpcs.set(seq, { resolve, reject })
    })

    this.methodStubs.set(method, func)
    return func
  }

  public set() {
    return false
  }

  public onReturn(seq: number, value: any, error: any) {
    const rpc = this.pendingRpcs.get(seq)
    if (!rpc) {
      return
    }

    this.pendingRpcs.delete(seq)

    if (error) {
      rpc.reject(error)
    } else {
      rpc.resolve(value)
    }
  }
}

function rpcInitProxies(transporter: Transporter): Map<string, ServiceProxyHandler> {
  let proxies: Map<string, ServiceProxyHandler> = Reflect.getMetadata(rpcProxiesMetadataKey, transporter)
  if (proxies) {
    return proxies
  }
  proxies = new Map<string, ServiceProxyHandler>()
  Reflect.defineMetadata(rpcProxiesMetadataKey, proxies, transporter)

  transporter.on('__rpc_return__', async ({ns, seq, value, error}: any) => {
    const proxyHandler = proxies.get(ns)
    if (proxyHandler) {
      proxyHandler.onReturn(seq, value, error)
    }
  })
  return proxies
}

export function getServiceProxy<T extends object = any>(transporter: Transporter, ns: string): T {
  const proxies: Map<string, any> = rpcInitProxies(transporter)
  let proxy = proxies.get(ns)
  if (proxy) {
    return proxy
  }

  const handler = new ServiceProxyHandler(transporter, ns)
  proxy = new Proxy<T>({} as any, handler)
  proxies.set(ns, handler)
  return proxy
}
