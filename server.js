const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
// Structure: { [socketId]: { id: socketId, uuid: '...', messages: [] } }
const chats = {};

// Admin socket ID (Assuming single admin for MVP simplicity, or use Room)
const ADMIN_ROOM = 'admin';

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Identifiers
    const userUUID = uuidv4();
    
    // Check if this is an admin connecting
    // For MVP security/simplicity, we might just assume anyone on /admin.html is admin 
    // or handle it via a specific 'join-admin' event sent from admin.html
    
    socket.on('join_admin', () => {
        socket.join(ADMIN_ROOM);
        console.log('Admin joined:', socket.id);
        // Send current list of chats to the new admin
        socket.emit('admin_init', chats);
    });

    socket.on('join_user', () => {
        // Register user in memory
        chats[socket.id] = {
            socketId: socket.id,
            uuid: userUUID,
            messages: [], // Array of { sender: 'user' | 'admin', text: string, time: number }
            timestamp: Date.now()
        };
        
        socket.emit('user_init', { uuid: userUUID });
        
        // Notify admins of new user
        io.to(ADMIN_ROOM).emit('user_connected', chats[socket.id]);
        console.log('User registered:', userUUID);
    });

    // Handle User Message
    socket.on('msg_user_to_admin', (msg) => {
        const userChat = chats[socket.id];
        if (!userChat) return;

        const messageData = {
            sender: 'user',
            text: msg,
            time: Date.now()
        };
        userChat.messages.push(messageData);

        // Send to Admins
        io.to(ADMIN_ROOM).emit('new_message', {
            userId: socket.id,
            message: messageData
        });
    });

    // Handle Admin Message
    socket.on('msg_admin_to_user', ({ targetSocketId, text }) => {
        const userChat = chats[targetSocketId];
        if (!userChat) return;

        const messageData = {
            sender: 'admin',
            text: text,
            time: Date.now()
        };
        userChat.messages.push(messageData);

        // Send to specific User
        io.to(targetSocketId).emit('new_message', messageData);
        
        // Also echo back to other admins (if any) so they see the reply
        // For this MVP, we just rely on client update or we can emit 'message_sent'
        // Let's emit to admin room to update views
        io.to(ADMIN_ROOM).emit('admin_sent_message', {
            userId: targetSocketId,
            message: messageData
        });
    });

    socket.on('disconnect', () => {
        if (chats[socket.id]) {
            console.log('User disconnected:', chats[socket.id].uuid);
            // Notify admins
            io.to(ADMIN_ROOM).emit('user_disconnected', socket.id);
            // Delete data (Volatility requirement)
            delete chats[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
