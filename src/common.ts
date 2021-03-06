export interface CallEventArg {
  ns: string // namespace
  seq: number
  method: string
  params: any[]
}

export interface ReturnEventArg {
  ns: string // namespace
  seq: number
  value?: any
  error?: string
}

export interface Transporter {
  emit(event: '__rpc_call__', value: CallEventArg): void
  emit(event: '__rpc_return__', value: ReturnEventArg): void
  on(event: '__rpc_call__', listener: (value: CallEventArg) => void): void
  on(event: '__rpc_return__', listener: (value: ReturnEventArg) => void): void
}

export interface RpcOptions {
  name?: string
}

export interface ServiceConfig {
  name: string
  methods: Map<string, (...args: any[]) => any>
}

export interface ActiveService {
  config: ServiceConfig
  instance: any
}


export const configMetaKey = Symbol('any-rpc:config')
export const servicesMetaKey = Symbol('any-rpc:services')
