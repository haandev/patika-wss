import { merge } from "../utils/deepmerge";
import { SocketClient } from "./SocketClient";
import { SocketServer } from "./SocketServer";

export class SocketChannel {
  private server: SocketServer;
  readonly id: string;
  private clients: SocketClient[] = [];
  private handlers: any = {};

  public history: Array<{ timestamp: any; cmds: Array<unknown> }> = [];
  public state: {
    shapes: unknown;
    chat: Array<unknown>;
    doc: object;
  } = {
    shapes: [],
    chat: [],
    doc: {},
  };
  public timestamps: any = {};

  constructor(server: SocketServer, id: string) {
    this.id = id;
    this.server = server;
    this.server.addChannel(this);
  }

 
  
  public setState(state) {
    this.state = state;
  }
  public patchState(patch) {
    this.state = merge(this.state, patch);
  }

  public addClient(client: SocketClient) {
    /** if the reference of this client instance is not exist in clients of this channel instance */
    if (this.clients.indexOf(client) === -1) {
      /** add reference of client instance to the clients array */
      this.clients.push(client);
      /** set clients channel property to reference of this */
      client.setChannel(this);
    }
  }

  public removeClient(client: SocketClient) {
    const index = this.clients?.indexOf(client);
    /** if the reference of this client instance is exist in clients of this channel instance */
    if (index > -1) {
      /** remove the reference from clients of this channel instance */
      this.clients.splice(index, 1);
    }
    /** remove channel instance when last client has left */
    if (this.clients.length === 0) {
      this.onClose();
    }
  }

  //TODO: set all clients channel to undefined on this method.
  private onClose() {
    this.server.removeChannel(this);
  }

  /**
   * the method to broadcasting anything between clients of this channel instance.
   * in the last argument you can optionally give client references that you do not want the message to reach
   */
  public broadcast(command: string, payload: any, except?: SocketClient[]) {
    this.clients.forEach((client) => !except?.includes(client) && client.send(command, payload));
  }

  public send(command: string, payload: any, to: SocketClient[]) {
    to.forEach((client) => client.send(command, payload));
  }

  public getClients(mapper) {
    return this.clients.map(mapper);
  }

  public setHistory(history) {
          this.history = history;
  }

}
