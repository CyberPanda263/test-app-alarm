import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import alarmSound from './public/audio/alarm.mp3';

// Автоматичне визначення хоста для роботи в будь-якому оточенні k8s
const API_BASE = window.location.origin;
const WS_URL = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://${window.location.host}`;

function App() {
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Стани для адміна
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('admin_token') || null);
  const [loginError, setLoginError] = useState('');

  const ws = useRef(null);
  const audioRef = useRef(new Audio(alarmSound));

  useEffect(() => {
    // Підключення клієнтів по WSS
    ws.current = new WebSocket(WS_URL);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE') {
        setIsAlarmActive(data.payload);
      }
    };

    // Отримання початкового стану через HTTP
    fetch(`${API_BASE}/api/alarm/status`)
      .then(res => res.json())
      .then(data => setIsAlarmActive(data.isAlarmActive))
      .catch(err => console.error("Помилка синхронізації статусу:", err));

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // ВИПРАВЛЕНО: Керування звуком залежно від взаємодії та стану тривоги
  useEffect(() => {
    const audio = audioRef.current;
    audio.loop = true;

    if (isAlarmActive && hasInteracted) {
      // Якщо є взаємодія і тривога активна - граємо звук
      audio.play().catch(e => {
        console.error("Браузер заблокував звук. Причина:", e.message);
      });
    } else {
      // Якщо тривоги немає або користувач ще не натиснув кнопку - зупиняємо
      audio.pause();
      audio.currentTime = 0;
    }

    // Правило хорошого тону в React: зупиняти аудіо при розмонтуванні компонента
    return () => {
      audio.pause();
    };
  }, [isAlarmActive, hasInteracted]);

  // Обробка входу адміна (HTTP POST)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('admin_token', data.token);
        setShowAdminModal(false);
      } else {
        setLoginError(data.error || 'Помилка входу');
      }
    } catch (err) {
      setLoginError('Сервер недоступний');
    }
  };

  // Триггер тривоги адміном (HTTP POST з JWT)
  const handleToggleAlarm = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alarm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !isAlarmActive })
      });
      if (res.status === 401 || res.status === 403) {
        // Токен застарів
        setToken(null);
        localStorage.removeItem('admin_token');
        setShowAdminModal(true);
      }
    } catch (err) {
      console.error("Не вдалося надіслати запит тривоги", err);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('admin_token');
  };

  return (
    <div className={`container ${isAlarmActive ? 'flash-red' : 'calm'}`}>
      
      {/* Шапка з кнопками адміна */}
      <div className="header-zone">
        {!token ? (
          <button className="sub-btn" onClick={() => setShowAdminModal(true)}>Панель керування</button>
        ) : (
          <div className="admin-controls-badge">
            <span className="badge">Адмін сесія активна</span>
            <button className="action-btn" onClick={handleToggleAlarm}>
              {isAlarmActive ? '🛑 ВИМКНУТИ ТРИВОГУ' : '🚨 УВІМКНУТИ ТРИВОГУ'}
            </button>
            <button className="logout-btn" onClick={handleLogout}>Вийти</button>
          </div>
        )}
      </div>

      {/* Основний вміст для клієнта */}
      {!hasInteracted ? (
        <div className="interaction-prompt">
          <h2>Система оповіщення</h2>
          <p>Для увімкнення звукового супроводу необхідно активувати підключення.</p>
          <button className="btn init-btn" onClick={() => setHasInteracted(true)}>Увійти на сайт</button>
        </div>
      ) : (
        <div className="client-content">
          <h1 className="status-title">{isAlarmActive ? 'УВАГА! ПОВІТРЯНА ТРИВОГА!' : 'Система моніторингу: СТАБІЛЬНО'}</h1>
          {isAlarmActive && (
            <div className="toast">
              🚨 УВАГА! Зафіксовано загрозу. Прямуйте в укриття!
            </div>
          )}
        </div>
      )}

      {/* Модальне вікно входу адміна */}
      {showAdminModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Вхід в панель адміністратора</h3>
            <form onSubmit={handleLogin}>
              <input 
                type="text" 
                placeholder="Логін" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="Пароль" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              {loginError && <p className="error-text">{loginError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn-submit">Увійти</button>
                <button type="button" className="btn-cancel" onClick={() => setShowAdminModal(false)}>Скасувати</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;