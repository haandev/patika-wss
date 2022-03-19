import ws from "ws";
import type { Server } from "http";

import { SocketClient } from "./SocketClient";
import { SocketChannel } from "./SocketChannel";



export class SocketServer {
  readonly socket: any;
  readonly clients: SocketClient[] = [];
  readonly channels: SocketChannel[] = [];

  constructor({ server, authenticator }: { server: Server; authenticator?: (props: any) => any | boolean }) {
    this.socket = new ws.Server({ server });
    /** when someone try to open a connection */
    this.socket.on("connection", (client, request) => {
      /** if there is an authenticator method */
      if (authenticator) {
        /** authenticate client with authenticator method */
        client.auth = authenticator(request) || client.send("invalid token");

        /** or close connection and return null */
        if (!client.auth) return null;
      }
      /** create new client instance */
      const gcClient = new SocketClient(client, this);

      /**
       * this is a working, event injection example of the design.
       * when client close the connection
       */
      gcClient.on("close", () => {
        /**
         * call removeClient method here.
         * this is just a sample, not necessary because when client close connection,
         * a script that has same purpose of this is working on SocketClient class.
         */
        this.removeClient(gcClient);
      });
    });
  }
  /**
   * a singleton-like method.
   * If there is a channel with the given id, it returns that instance.
   * otherwise it creates it and returns the instance
   */
  public getChannelById(channelId: string) {
    return this.channels.find((channel) => channel.id === channelId) || new SocketChannel(this, channelId);
  }

  /** add new client reference to clients of this server instance */
  public addClient(client: SocketClient) {
    this.clients.push(client);
  }

  /** remove reference of given client instance from clients of this server instance */
  public removeClient(client: SocketClient) {
    const index = this.clients.indexOf(client);
    if (index > -1) {
      this.clients.splice(index, 1);
    }
  }

  /**
   * add new channel reference to channels of this server instance
   * this method will only fire from constructor of SocketChannel class
   */
  public addChannel(channel: SocketChannel) {
    this.channels.push(channel);
  }

  /**
   * remove reference of given channel instance from channels of this server instance
   * this method will only fire from onClose method of SocketChannel class
   */
  public removeChannel(channel: SocketChannel) {
    const index = this.channels.indexOf(channel);
    if (index > -1) {
      this.channels.splice(index, 1);
    }
  }
}
