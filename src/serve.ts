import 'reflect-metadata'
import {Transporter} from './common'

interface ServiceOptions {
  name?: string
  methods?: Map<string, (...args: any[]) => any>
}

interface RegisteredService extends ServiceOptions {
  instance: any
}

const rpcOptionsMetadataKey = Symbol('any-rpc:options')
const rpcServicesMetadataKey = Symbol('any-rpc:services')

// tslint:disable-next-line: ban-types
export const Rpc = (options?: ServiceOptions) => (constructor: Function) => {
  const target = constructor.prototype
  const rpcOptions = Reflect.getMetadata(rpcOptionsMetadataKey, target)
  Object.assign(rpcOptions, options)
  if (!rpcOptions.name) {
    rpcOptions.name = constructor.name
  }
}

export const exported = (target: any, propKey?: string) => {
  let options: ServiceOptions = Reflect.getMetadata(rpcOptionsMetadataKey, target)
  if (!options) {
    options = {
      methods: new Map<string, (...args: any[]) => any>()
    }
    Reflect.defineMetadata(rpcOptionsMetadataKey, options, target)
  }
  options.methods.set(propKey, target[propKey])
}

function rpcInitServices(transporter: Transporter): Map<string, RegisteredService> {
  let services: Map<string, RegisteredService> = Reflect.getMetadata(rpcServicesMetadataKey, transporter)
  if (services) {
    return services
  }
  services = new Map<string, RegisteredService>()
  Reflect.defineMetadata(rpcServicesMetadataKey, services, transporter)
  transporter.on('__rpc_call__', async ({ns, seq, method, params}: any) => {
    const service = services.get(ns)
    if (!service) {
      transporter.emit('__rpc_return__', {
        ns,
        seq,
        error: 'Service not found'
      })
      return
    }

    if (!service.methods.has(method)) {
      transporter.emit('__rpc_return__', {
        ns,
        seq,
        error: `Rpc method "${method}" not found`
      })
      return
    }
    try {
      let value = service.methods.get(method).apply(service.instance, params)
      if (value && value.then) {
        value = await value
      }
      transporter.emit('__rpc_return__', { ns, seq, value })
    } catch (e) {
      transporter.emit('__rpc_return__', {
        ns,
        seq,
        error: e.toString()
      })
    }
  })
  return services
}

export function rpcServe(transporter: Transporter, service: any) {
  const options: ServiceOptions = Reflect.getMetadata(rpcOptionsMetadataKey, service.__proto__)
  if (!options || !options.name) {
    throw new Error('Not a valid rpc service')
  }

  const services = rpcInitServices(transporter)
  if (services.has(options.name)) {
    services.delete(options.name)
  }

  services.set(options.name, Object.assign({
    instance: service
  }, options))
}

export function rpcStop(transporter: Transporter, ns: string) {
  const services: Map<string, RegisteredService> = Reflect.getMetadata(rpcServicesMetadataKey, transporter)
  if (services && services.has(ns)) {
    services.delete(ns)
  }
}
