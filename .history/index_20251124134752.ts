import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

interface Client {
  id: string;
  ws: WebSocket;
  username: string;
}

interface Message {
  type: 'join' | 'message' | 'leave' | 'user_list';
  userId?: string;
  username?: string;
  content?: string;
  timestamp?: number;
  users?: string[];
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