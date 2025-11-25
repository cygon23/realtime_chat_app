import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

interface Client {
  id: string;
  ws: WebSocket;
  username: string;
}

interface Message {
  type: 'join' | 'message' | 'leave' | 'user_list' | 'typing' | 'stop_typing' | 'reaction_add' | 'reaction_remove';
  userId?: string;
  username?: string;
  content?: string;
  timestamp?: number;
  users?: string[];
  messageId?: string;
  emoji?: string;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });
const clients = new Map<string, Client>();

// Broadcast to all connected clients
function broadcast(message: Message, excludeId?: string) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

// Send updated user list to all clients
function broadcastUserList() {
  const users = Array.from(clients.values()).map(c => c.username);
  broadcast({ type: 'user_list', users });
}

wss.on('connection', (ws: WebSocket) => {
  const clientId = uuidv4();
  let client: Client | null = null;

  console.log(`Client connected: ${clientId}`);

  ws.on('message', (data: Buffer) => {
    try {
      const message: Message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join':
          if (message.username) {
            client = { id: clientId, ws, username: message.username };
            clients.set(clientId, client);

            // Send join notification to others
            broadcast({
              type: 'join',
              userId: clientId,
              username: message.username,
              timestamp: Date.now()
            }, clientId);

            // Send user list to everyone
            broadcastUserList();
            console.log(`${message.username} joined the chat`);
          }
          break;

        case 'message':
          if (client && message.content) {
            // Broadcast message to all clients
            broadcast({
              type: 'message',
              userId: clientId,
              username: client.username,
              content: message.content,
              timestamp: Date.now()
            });
            console.log(`${client.username}: ${message.content}`);
          }
          break;

        case 'typing':
          if (client) {
            // Broadcast typing indicator to all other clients
            broadcast({
              type: 'typing',
              userId: clientId,
              username: client.username
            }, clientId);
          }
          break;

        case 'stop_typing':
          if (client) {
            // Broadcast stop typing indicator to all other clients
            broadcast({
              type: 'stop_typing',
              userId: clientId,
              username: client.username
            }, clientId);
          }
          break;

        case 'reaction_add':
          if (client && message.messageId && message.emoji) {
            // Broadcast reaction add to all clients (including sender)
            broadcast({
              type: 'reaction_add',
              userId: clientId,
              username: client.username,
              messageId: message.messageId,
              emoji: message.emoji
            });
            console.log(`${client.username} reacted with ${message.emoji} to message ${message.messageId}`);
          }
          break;

        case 'reaction_remove':
          if (client && message.messageId && message.emoji) {
            // Broadcast reaction remove to all clients (including sender)
            broadcast({
              type: 'reaction_remove',
              userId: clientId,
              username: client.username,
              messageId: message.messageId,
              emoji: message.emoji
            });
            console.log(`${client.username} removed ${message.emoji} from message ${message.messageId}`);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (client) {
      console.log(`${client.username} disconnected`);
      clients.delete(clientId);

      // Notify others about disconnect
      broadcast({
        type: 'leave',
        userId: clientId,
        username: client.username,
        timestamp: Date.now()
      });

      // Update user list
      broadcastUserList();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});