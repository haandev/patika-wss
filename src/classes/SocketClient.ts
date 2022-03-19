import { v4 as uuidv4 } from "uuid";
import { SocketChannel } from "./SocketChannel";

import { GCCommunicatorDependency, SocketServer } from "./SocketServer";
import { SocketClientEvent, SocketClientEventName } from "./SocketClientEvent";
import { SocketCommunicator } from "./SocketCommunicator";

export class SocketClient {
  private wsClient: any;
  readonly id: string;
  readonly server: SocketServer;
  private channel: SocketChannel;
  private communicator: SocketCommunicator/*   | GCCommunicatorDependency */
  private events: { [key: string]: SocketClientEvent } = {};

  constructor(nativeClient: any, server: SocketServer) {
    this.id = uuidv4();
    this.server = server;
    this.server.addClient(this);
    this.wsClient = nativeClient;
    this.communicator = new SocketCommunicator(server, this);

    /** native on-close handler */
    this.wsClient.on("close", (_code) => {
      this.onClose();
    });

    /** native on-message handler */
    this.wsClient.on("message", (data: string) => {
      this.onMessage(data);
    });
  }

  private onClose() {
    this.communicator.close();

    /** remove reference from channel instance */
    this.channel?.removeClient(this);

    /** remove reference from server instance */
    this.server.removeClient(this);
    /** v8 garbage collector will remove for us the last instance that has no tie */

    /** injected event on server class */
    this.events.close.do();
  }

  /** method to communicator messages */
  private onMessage(data: string) {
    /** parse message, mesage format has to be like this {command: string, payload: string | json} */
    const message = JSON.parse(data);

    this.communicator[message.command]?.(message.payload);
    this.events[message.command]?.do?.();
  }

  public getUsername() {
    return this.wsClient.auth?.username;
  }

  public setChannel(channel: SocketChannel) {
    /** if channel is different from stored one */
    if (this.channel && this.channel !== channel) {
      /** remove reference of this client from clients of previous channel instance  */
      this.channel.removeClient(this);
    }

    /**
     * set channel value of this client instance as reference of given channel
     * adding client list of the channel instance operation is already fired on the method who fire this
     */
    this.channel = channel;
  }
  public setCommunicator(dependency: GCCommunicatorDependency) {
    this.communicator = new dependency(this.server, this);
  }
  public getCommunicator() {
    return this.communicator
  }
  public getChannel() {
    return this.channel;
  }

  /** I am not sure about the need of this */
  public on(eventName: SocketClientEventName, callback) {
    this.events[eventName] = new SocketClientEvent(callback);
    return this.events[eventName];
  }

  /** abstraction of native send method */
  public send(command: string, payload: any) {
    this.wsClient.send(JSON.stringify({ command, payload }));
  }
}
