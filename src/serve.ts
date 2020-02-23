import 'reflect-metadata'
import {
    Transporter, CallEventArg, ActiveService, ServiceConfig,
    servicesMetaKey, configMetaKey
} from './common'

function getConfig(serviceInstance: any) : ServiceConfig {
    return Reflect.getMetadata(configMetaKey, serviceInstance.__proto__)
}

async function callService(
    transporter: Transporter,
    services: Map<string, ActiveService>,
    { ns, seq, method, params }: CallEventArg
) {
    const service = services.get(ns)
    let error: string | undefined
    let value: any | undefined
    if (!service) {
        error = `Service ${ns} not found`
    } else {
        const func = service.config.methods.get(method)
        if (!func) {
            error = `Rpc method "${ns}.${method}" not found`
        } else {
            try {
                value = func.apply(service.instance, params)
                if (value && value.then && typeof value.then === 'function') {
                    value = await value
                }
            } catch (e) {
                error = e.toString()
            }
        }
    }
    if (error) {
        transporter.emit('__rpc_return__', { ns, seq, error })
    } else {
        transporter.emit('__rpc_return__', { ns, seq, value })
    }
}

function getOrCreateServiceContainer(transporter: Transporter): Map<string, ActiveService> {
    let services: Map<string, ActiveService> = Reflect.getMetadata(servicesMetaKey, transporter)
    if (services) {
        return services
    }
    services = new Map<string, ActiveService>()
    Reflect.defineMetadata(servicesMetaKey, services, transporter)
    transporter.on('__rpc_call__',(args : CallEventArg) => {
        callService(transporter, services, args)
    })
    return services
}

export function rpcServe(transporter: Transporter, instance: any) {
    const config = getConfig(instance)
    if (!config || !config.name) {
        console.log(config)
        throw new Error('Not a valid rpc service')
    }

    const services = getOrCreateServiceContainer(transporter)
    services.set(config.name, { instance, config })
}

export function rpcStop(transporter: Transporter, ns: string) {
    const services: Map<string, ActiveService> = Reflect.getMetadata(servicesMetaKey, transporter)
    if (services && services.has(ns)) {
        services.delete(ns)
    }
}
