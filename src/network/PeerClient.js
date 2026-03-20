import { Peer } from 'peerjs';
import { createMessage, isValidMessageShape, MESSAGE_TYPES } from './protocol.js';

export class PeerClient {
    constructor({
        onLocalPeerId,
        onConnectionOpen,
        onConnectionClosed,
        onMessage,
        onError,
    } = {}) {
        this.peer = null;
        this.connection = null;
        this.remotePeerId = null;
        this.onLocalPeerId = onLocalPeerId;
        this.onConnectionOpen = onConnectionOpen;
        this.onConnectionClosed = onConnectionClosed;
        this.onMessage = onMessage;
        this.onError = onError;
    }

    createSession(sessionKey = null) {
        if (this.peer) this.destroy();
        this.peer = sessionKey ? new Peer(sessionKey) : new Peer();
        this.attachPeerHandlers(true);
    }

    joinSession(remotePeerId) {
        if (this.peer) this.destroy();
        this.remotePeerId = remotePeerId;
        this.peer = new Peer();
        this.attachPeerHandlers(false);
    }

    attachPeerHandlers(isHost) {
        this.peer.on('open', (id) => {
            if (this.onLocalPeerId) this.onLocalPeerId(id);
            if (isHost) return;
            const conn = this.peer.connect(this.remotePeerId, { reliable: true });
            this.attachConnection(conn);
        });

        this.peer.on('connection', (conn) => {
            if (this.connection && this.connection.open) {
                conn.close();
                return;
            }
            this.remotePeerId = conn.peer;
            this.attachConnection(conn);
        });

        this.peer.on('error', (error) => {
            if (this.onError) this.onError(error);
        });
    }

    attachConnection(conn) {
        this.connection = conn;
        conn.on('open', () => {
            if (this.onConnectionOpen) this.onConnectionOpen(conn.peer);
        });

        conn.on('data', (raw) => {
            if (!isValidMessageShape(raw)) return;
            if (this.onMessage) this.onMessage(raw);
        });

        conn.on('close', () => {
            if (this.onConnectionClosed) this.onConnectionClosed();
        });

        conn.on('error', (error) => {
            if (this.onError) this.onError(error);
        });
    }

    send(type, payload = {}) {
        if (!this.connection || !this.connection.open) return false;
        this.connection.send(createMessage(type, payload));
        return true;
    }

    sendError(message) {
        this.send(MESSAGE_TYPES.ERROR, { message });
    }

    isConnected() {
        return Boolean(this.connection && this.connection.open);
    }

    destroy() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
