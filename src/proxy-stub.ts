import 'reflect-metadata'
import { Transporter } from './common'

const rpcProxiesMetadataKey = Symbol('any-rpc:proxies')

interface MethodStub {
    invoke: Function
    send: Function
}

class ServiceProxyHandler {
    // tslint:disable-next-line: ban-types
    private methodStubs = new Map<string, MethodStub>()
    private seq = 1
    private pendingRpcs = new Map<number, {
        resolve: (value: any) => void
        reject: (error: any) => void
    }>()

    public proxy: any = null

    constructor(private readonly transporter: Transporter, private readonly ns: string) {
    }

    // tslint:disable-next-line: ban-types
    public get(target: any, method: string): MethodStub {
        let stub = this.methodStubs.get(method)
        if (stub) {
            return stub
        }

        stub = {
            invoke: (...params: any[]) => new Promise(
                (resolve: (value: any) => void, reject: (error: any) => void) => {
                    const seq = this.seq++
                    this.transporter.emit('__rpc_call__', {
                        ns: this.ns, seq, method, params
                    })
                    this.pendingRpcs.set(seq, { resolve, reject })
                }),
            send: (...params: any[]) => {
                this.transporter.emit('__rpc_call__', {
                    ns: this.ns, seq: 0, method, params
                })
            }
        }

        this.methodStubs.set(method, stub)
        return stub
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

function getOrCreateProxy(transporter: Transporter): Map<string, ServiceProxyHandler> {
    let proxyHandlers: Map<string, ServiceProxyHandler> = Reflect.getMetadata(rpcProxiesMetadataKey, transporter)
    if (proxyHandlers) {
        return proxyHandlers
    }
    proxyHandlers = new Map<string, ServiceProxyHandler>()
    Reflect.defineMetadata(rpcProxiesMetadataKey, proxyHandlers, transporter)

    transporter.on('__rpc_return__', async ({ ns, seq, value, error }: any) => {
        const proxyHandler = proxyHandlers.get(ns)
        if (proxyHandler) {
            proxyHandler.onReturn(seq, value, error)
        }
    })
    return proxyHandlers
}

export function getServiceProxy<T extends object = any>(transporter: Transporter, ns: string): T {
    const proxyHandlers = getOrCreateProxy(transporter)
    let handler = proxyHandlers.get(ns)
    if (handler) {
        return handler.proxy
    }

    handler = new ServiceProxyHandler(transporter, ns)
    handler.proxy = new Proxy<T>({} as any, handler)
    proxyHandlers.set(ns, handler)
    return handler.proxy
}
