/**
 * Socket.IO Transport Implementation
 * Concrete implementation of SyncTransport using Socket.IO
 */

import { SyncTransport, SyncMessage } from './SynchronizationService';
import { Socket, io } from 'socket.io-client';

export class SocketIOTransport implements SyncTransport {
  private socket: Socket | null = null;
  private url: string;
  private options: any;
  private connectCallbacks: Array<() => void> = [];
  private disconnectCallbacks: Array<() => void> = [];
  private messageCallbacks: Array<(_message: SyncMessage) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];

  constructor(url: string, options: any = {}) {
    this.url = url;
    this.options = {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      ...options
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.url, this.options);

      this.socket.on('connect', () => {
        this.connectCallbacks.forEach(callback => callback());
        resolve();
      });

      this.socket.on('disconnect', (_reason) => {
        this.disconnectCallbacks.forEach(callback => callback());
      });

      this.socket.on('sync-message', (_message: SyncMessage) => {
        this.messageCallbacks.forEach(callback => callback(_message));
      });

      this.socket.on('connect_error', (error) => {
        this.errorCallbacks.forEach(callback => callback(new Error(error.message)));
        reject(error);
      });

      this.socket.on('error', (error) => {
        this.errorCallbacks.forEach(callback => callback(new Error(error.message)));
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async send(message: SyncMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('sync-message', message, (ack: any) => {
        if (ack?.error) {
          reject(new Error(ack.error));
        } else {
          resolve();
        }
      });

      // Timeout for acknowledgment
      setTimeout(() => {
        reject(new Error('Send timeout'));
      }, 5000);
    });
  }

  onConnect(callback: () => void): void {
    this.connectCallbacks.push(callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  onMessage(callback: (message: SyncMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}
