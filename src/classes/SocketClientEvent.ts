export type SocketClientEventName = 'close' | 'message' | 'channel'
/** a promise-like event class to make thinks easy */
export class SocketClientEvent<T = any> {
  promise?: Promise<T>
  callback?: any
  do?: () => Promise<T>
  reject?: any
  constructor(callback?: any) {
    
    this.callback = callback
    this.promise = new Promise((resolve, reject) => {
      this.do = () => {
        resolve(this.callback?.())
        return this.promise
      }
      this.reject = reject
    })
  }
  then(callback?: any) {
    return this.promise.then(callback)
  }
  catch(callback?: any) {
    return this.promise.catch(callback)
  }
  finally(callback?: any) {
    return this.promise.catch(callback)
  }
}
