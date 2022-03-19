import { SocketChannel } from "./SocketChannel";
import { SocketClient } from "./SocketClient";
import {  SocketServer } from "./SocketServer";

/** common communication interface of server and client*/
export interface ISocketCommunicator {
  setChannel: (props: { id: string }) => void;
  channelChat?: (props: { text: string; sender?: string }) => void;
  removeChannelMember?: (id: string) => void;
  addChannelMember?: (member: SocketClient | any) => void;
  setChannelMembers?: (members: SocketClient[] | any[]) => void;
  spreadCommand?:any
}
/** type of broadcast-able command */

/** it will be an interface to handshake server-client commands */
export class SocketCommunicator implements ISocketCommunicator {
  server: SocketServer;
  client: SocketClient;
  channel: SocketChannel;

  constructor(server: SocketServer, client: SocketClient) {
    this.server = server;
    this.client = client;
  }

  public getData() {
    return {};
  }

  public close() {
    /** tell everybody who left the channel */
    this.channel?.broadcast("removeChannelMember", this.client.id);
  }

  
  public channelChat({ text }: { text: string }) {
    this.channel.broadcast('channelChat', {
      sender: this.client.getUsername(),
      text,
    })
  }
  public setChannel({ id }: { id: string }) {

    /** set communicators new channel */
    this.client.getCommunicator().channel = this.server.getChannelById(id);
    
    /** send old channel members, who left the channel */
    this.client.getChannel()?.broadcast("removeChannelMember", this.client.id, [this.client]);

    /** add client to channel */
    this.client.getCommunicator().channel.addClient(this.client);

    /** send client to setChannel command back to tell him commend success */
    let data = this.client.getCommunicator().getData();
    this.client.send("setChannel", { id, type, data });

    /** send client the channel members of new channel */
    this.client.send(
      "setChannelMembers",
      this.client.getCommunicator().channel.getClients((client) => ({
        username: client.getUsername(),
        id: client.id,
      }))
    );

    /** send new channel members, who came */
    this.client.getCommunicator().channel.broadcast(
      "addChannelMember",
      {
        id: this.client.id,
        username: this.client.getUsername(),
      },
      [this.client]
    );
  }
}
