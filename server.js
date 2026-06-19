const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Роздача статичних файлів зібраного React-додатка
app.use(express.static(path.join(__dirname, 'frontend/dist')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isAlarmActive = false;
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Middleware для захисту HTTP маршрутів адміна за допомогою JWT
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Доступ заборонено' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Недійсний токен' });
    req.user = user;
    next();
  });
};

// HTTP: Вхід адміністратора
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Невірний логін або пароль' });
});

// HTTP: Перемикання тривоги (тільки для авторизованого адміна)
app.post('/api/alarm', authenticateAdmin, (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Невірний формат статусу' });
  }
  
  isAlarmActive = active;

  // Миттєва розсилка оновленого стану всім підключеним клієнтам по WSS
  broadcastToClients({ type: 'STATE', payload: isAlarmActive });

  return res.json({ success: true, isAlarmActive });
});

// HTTP: Поточний статус (корисно для початкової синхронізації)
app.get('/api/alarm/status', (req, res) => {
  res.json({ isAlarmActive });
});

// WSS: Обробка підключень клієнтів
wss.on('connection', (ws) => {
  // Відправляємо поточний стан тривоги відразу при підключенні
  ws.send(JSON.stringify({ type: 'STATE', payload: isAlarmActive }));
  
  ws.on('error', console.error);
});

function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Перенаправлення всіх інших GET запитів на React (підтримка SPA маршрутизації)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Сервер працює на порту ${PORT}`);
});