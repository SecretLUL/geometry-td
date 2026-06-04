/*
 * @file: frontend/src/js/core/multiplayer/webrtc.ts
 * @purpose: WebRTC DataChannel connection manager supporting unreliable, unordered UDP-like
 *           coordination streams between host and clients.
 * @dependencies: socket, state
 * @last_update: 2026-05-28 / v1.4.0 - Added state.webRTCStatus state updates for clients on connection events and socket fallbacks.
 */

import { socket, Multiplayer } from './context';
import { state } from '../state';
import { logger } from '../logger';

// Standard public STUN servers to resolve external IP and ports over Docker/host networks
let rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

export function setIceServers(iceServers: RTCIceServer[]): void {
    if (iceServers && iceServers.length > 0) {
        rtcConfig = { iceServers };
    }
}

// Host-specific mapping: client socket ID -> Peer Connection & Data Channel
const hostConnections = new Map<string, RTCPeerConnection>();
const hostChannels = new Map<string, RTCDataChannel>();

// Client-specific references to Host
let clientConnection: RTCPeerConnection | null = null;
let clientChannel: RTCDataChannel | null = null;
let currentHostId: string | null = null;

let weAreHost = false;

// Retry logic to prevent infinite ICE gathering loop on persistent failure
let connectionRetries = 0;
const MAX_CONNECTION_RETRIES = 3;

// Register incoming message handler
let onWebRTCMessageReceived: ((payload: any) => void) | null = null;

export function registerWebRTCMessageHandler(handler: (payload: any) => void): void {
    onWebRTCMessageReceived = handler;
}

// Clean up client-side WebRTC resources
export function cleanupClientWebRTC(): void {
    if (clientChannel) {
        try { clientChannel.close(); } catch (e) {}
        clientChannel = null;
    }
    if (clientConnection) {
        try { clientConnection.close(); } catch (e) {}
        clientConnection = null;
    }
}

// Clean up host-side WebRTC resources
export function cleanupHostWebRTC(): void {
    for (const conn of hostConnections.values()) {
        try { conn.close(); } catch (e) {}
    }
    hostConnections.clear();
    
    for (const chan of hostChannels.values()) {
        try { chan.close(); } catch (e) {}
    }
    hostChannels.clear();
}

// Clean up everything WebRTC related
export function cleanupAllWebRTC(): void {
    cleanupClientWebRTC();
    cleanupHostWebRTC();
    currentHostId = null;
    weAreHost = false;
    connectionRetries = 0;
    state.webRTCStatus = 'idle';
    if (Multiplayer && Multiplayer.updateUI) {
        Multiplayer.updateUI();
    }
}

// Configure common PeerConnection listeners (ICE discovery and status logging)
function setupCommonPC(pc: RTCPeerConnection, targetId: string): void {
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && socket && socket.connected) {
            socket.emit("webrtc_signal", {
                targetId: targetId,
                signal: { type: "candidate", candidate: event.candidate }
            });
        }
    };

    pc.onconnectionstatechange = () => {
        logger.info(`[WebRTC] Connection state with ${targetId}: ${pc.connectionState}`);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            if (!weAreHost && pc === clientConnection) {
                cleanupClientWebRTC();
                if (connectionRetries < MAX_CONNECTION_RETRIES) {
                    connectionRetries++;
                    state.webRTCStatus = 'connecting';
                    if (Multiplayer && Multiplayer.updateUI) {
                        Multiplayer.updateUI();
                    }
                    setTimeout(() => {
                        if (!weAreHost && currentHostId === targetId && socket && socket.connected) {
                            initiateConnectionToHost(targetId);
                        }
                    }, 3000);
                } else {
                    logger.warn(`[WebRTC] Client connection failed after ${MAX_CONNECTION_RETRIES} attempts. Disabling WebRTC retries and falling back to Socket.io.`);
                    state.webRTCStatus = 'failed';
                    if (Multiplayer && Multiplayer.updateUI) {
                        Multiplayer.updateUI();
                    }
                }
            } else if (weAreHost) {
                // Host handles client disconnect
                const existingPC = hostConnections.get(targetId);
                if (existingPC === pc) {
                    hostConnections.delete(targetId);
                    const chan = hostChannels.get(targetId);
                    if (chan) {
                        try { chan.close(); } catch (e) {}
                        hostChannels.delete(targetId);
                    }
                }
            }
        }
    };
}

// Client initiates direct UDP-like PeerConnection to Host
export function initiateConnectionToHost(hostId: string): void {
    if (!socket || !socket.connected) {
        logger.warn("[WebRTC] Socket not connected. Cannot initiate connection.");
        return;
    }

    cleanupClientWebRTC();

    state.webRTCStatus = 'connecting';
    if (Multiplayer && Multiplayer.updateUI) {
        Multiplayer.updateUI();
    }

    const pc = new RTCPeerConnection(rtcConfig);
    clientConnection = pc;

    // Create unordered, unreliable data channel (UDP behavior)
    // maxRetransmits: 0 -> don't retry lost packets
    // ordered: false -> don't delay subsequent packets (no Head-of-Line Blocking)
    const channel = pc.createDataChannel("gameState", {
        ordered: false,
        maxRetransmits: 0
    });
    clientChannel = channel;

    // Listeners for client DataChannel
    channel.onopen = () => {
        connectionRetries = 0; // Reset connection retry counter on success
        state.webRTCStatus = 'connected';
        if (Multiplayer && Multiplayer.updateUI) {
            Multiplayer.updateUI();
        }
    };
    channel.onclose = () => {
    };
    channel.onerror = (err) => {
        logger.error("[WebRTC] DataChannel error:", { error: err });
    };
    channel.onmessage = (event: MessageEvent) => {
        if (!onWebRTCMessageReceived) return;
        try {
            const payload = JSON.parse(event.data);
            onWebRTCMessageReceived(payload);
        } catch (err) {
            logger.error("[WebRTC] Error parsing incoming game state:", { error: err });
        }
    };

    setupCommonPC(pc, hostId);

    // Create SDP Offer
    pc.createOffer()
        .then((offer: RTCSessionDescriptionInit) => pc.setLocalDescription(offer))
        .then(() => {
            socket.emit("webrtc_signal", {
                targetId: hostId,
                signal: { type: "offer", offer: pc.localDescription }
            });
        })
        .catch((err: any) => logger.error("[WebRTC] Error creating offer:", { error: err }));
}

// Handles incoming WebRTC signaling messages relayed from the server
export function handleWebRTCSignal(senderId: string, signal: any): void {
    if (!socket || !socket.connected) return;

    if (signal.type === "offer") {
        if (!weAreHost) {
            logger.warn("[WebRTC] Received WebRTC offer but we are not the Host! Ignoring.");
            return;
        }

        // Cleanup existing connection to this client if any
        const existingPC = hostConnections.get(senderId);
        if (existingPC) {
            try { existingPC.close(); } catch (e) {}
            hostConnections.delete(senderId);
        }
        const existingChan = hostChannels.get(senderId);
        if (existingChan) {
            try { existingChan.close(); } catch (e) {}
            hostChannels.delete(senderId);
        }

        const pc = new RTCPeerConnection(rtcConfig);
        hostConnections.set(senderId, pc);

        setupCommonPC(pc, senderId);

        // Host listens for DataChannel created by Client
        pc.ondatachannel = (event: RTCDataChannelEvent) => {
            const channel = event.channel;
            if (channel.label === "gameState") {
                hostChannels.set(senderId, channel);

                channel.onopen = () => {
                    if (Multiplayer && Multiplayer.syncNow) {
                        Multiplayer.syncNow();
                    }
                };
                channel.onclose = () => {
                    hostChannels.delete(senderId);
                };
                channel.onerror = (err) => {
                    logger.error(`[WebRTC] DataChannel error for client ${senderId}:`, { error: err });
                };
            }
        };

        // Set Remote Description and Create SDP Answer
        pc.setRemoteDescription(new RTCSessionDescription(signal.offer))
            .then(() => pc.createAnswer())
            .then((answer: RTCSessionDescriptionInit) => pc.setLocalDescription(answer))
            .then(() => {
                socket.emit("webrtc_signal", {
                    targetId: senderId,
                    signal: { type: "answer", answer: pc.localDescription }
                });
            })
            .catch((err: any) => logger.error(`[WebRTC] Error handling offer from client ${senderId}:`, { error: err }));

    } else if (signal.type === "answer") {
        if (!weAreHost && clientConnection) {
            clientConnection.setRemoteDescription(new RTCSessionDescription(signal.answer))
                .catch((err: any) => logger.error("[WebRTC] Error setting remote answer:", { error: err }));
        } else if (weAreHost) {
            logger.warn("[WebRTC] Host received an answer packet. Host only processes offers.");
        }

    } else if (signal.type === "candidate") {
        const pc = weAreHost ? hostConnections.get(senderId) : clientConnection;
        if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch((err: any) => logger.error(`[WebRTC] Error adding ICE candidate from ${senderId}:`, { error: err }));
        }
    }
}

// Update the role state
export function setWebRTCRole(isHost: boolean, hostSocketId: string | null): void {
    weAreHost = isHost;
    currentHostId = hostSocketId;

    if (isHost) {
        cleanupClientWebRTC();
        state.webRTCStatus = 'idle';
    } else {
        cleanupHostWebRTC();
        connectionRetries = 0; // Reset retries on manual/role switch
        if (hostSocketId) {
            initiateConnectionToHost(hostSocketId);
        } else {
            state.webRTCStatus = 'idle';
        }
    }
    if (Multiplayer && Multiplayer.updateUI) {
        Multiplayer.updateUI();
    }
}

// Broadcast game state over WebRTC DataChannels.
// Returns true if sent to ALL active clients, false if a fallback to Socket.io is required for any client.
export function broadcastGameStateWebRTC(payload: any): boolean {
    if (!weAreHost) return false;
    if (hostChannels.size === 0) return false;

    const messageStr = JSON.stringify(payload);
    let allSent = true;

    for (const [clientId, channel] of hostChannels.entries()) {
        if (channel.readyState === 'open') {
            try {
                channel.send(messageStr);
            } catch (err) {
                logger.error(`[WebRTC] Failed to send game state to client ${clientId}:`, { error: err });
                allSent = false;
            }
        } else {
            allSent = false;
        }
    }

    return allSent;
}

// Helper to check if client's WebRTC channel is open
export function isClientWebRTCOpen(): boolean {
    return !weAreHost && clientChannel?.readyState === 'open';
}

// Check if Host has active WebRTC clients
export function hasActiveWebRTCClients(): boolean {
    if (!weAreHost) return false;
    for (const channel of hostChannels.values()) {
        if (channel.readyState === 'open') {
            return true;
        }
    }
    return false;
}
