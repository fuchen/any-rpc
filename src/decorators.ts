import {
    ServiceConfig, RpcOptions, configMetaKey
} from './common'

function getOrCreateConfig(target: any) {
    let config: ServiceConfig = Reflect.getMetadata(configMetaKey, target)
    if (!config) {
        config = {
            name: "",
            methods: new Map<string, (...args: any[]) => any>()
        }
        Reflect.defineMetadata(configMetaKey, config, target)
    }
    return config
}
// tslint:disable-next-line: ban-types
export function rpc(options?: RpcOptions) {
    return (constructor: Function) => {
        const target = constructor.prototype
        const config = getOrCreateConfig(target)
        Reflect.defineMetadata(configMetaKey, {
            ...config,
            ...options,
            name: options && options.name || constructor.name
        }, target)
    }
}

export function exported(target: any, propKey: string) {
    const config: ServiceConfig = getOrCreateConfig(target)
    config.methods.set(propKey, target[propKey])
}
