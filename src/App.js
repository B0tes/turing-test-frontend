// src/App.js

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io(process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_BACKEND_URL 
  : 'http://localhost:3000');

function App() {
  const [role, setRole] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('Select your role to begin.');
  const [chatEnded, setChatEnded] = useState(false);
  const [gameReason, setGameReason] = useState(null); // --- NEW: To store why the game ended ---
  const [guessResult, setGuessResult] = useState(null); // --- NEW: To store the result of a guess ---
  const [timeLeft, setTimeLeft] = useState(90); // Timer state
  const [timerInterval, setTimerInterval] = useState(null); // Store interval reference
  const [watchingGame, setWatchingGame] = useState(false); // State for watching AI games
  const [watchingSessionId, setWatchingSessionId] = useState(null); // Track which game we're watching

  useEffect(() => {
    socket.on('waitingForPartner', (message) => {
      setStatus(message);
    });

    socket.on('matchFound', (data) => {
      setSessionId(data.sessionId);
      setStatus(data.message);
      setRole(data.role);
      setChatEnded(false);
      setGameReason(null); // --- NEW: Resetting state for a new game ---
      setGuessResult(null); // --- NEW: Resetting state for a new game ---
      
      // Start the timer
      setTimeLeft(90);
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimerInterval(interval);

      if (data.aiPersona) {
        setMessages([{ sender: 'system', text: `You are matched with an AI. Your persona is: "${data.aiPersona}"` }]);
      } else {
        setMessages([{ sender: 'system', text: data.message }]);
      }
    });

    socket.on('newMessage', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // --- NEW: A single event listener for all game endings ---
    socket.on('gameEnd', (data) => {
      setChatEnded(true);
      setGameReason(data.reason);
      
      // Clear the timer
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }

      if (data.reason === 'guess') {
        setGuessResult(data.result);
      }
      setStatus('Game over!');
    });

    socket.on('watchingGame', (data) => {
      setWatchingGame(true);
      setWatchingSessionId(data.sessionId);
      setStatus(data.message);
      setMessages([{ sender: 'system', text: data.message }]);
    });

    socket.on('gameComplete', (data) => {
      if (watchingGame) {
        setStatus(data.message);
        setMessages((prevMessages) => [...prevMessages, { sender: 'system', text: data.message }]);
      }
    });

    socket.on('error', (message) => {
      setStatus(message);
    });

    return () => {
      socket.off('waitingForPartner');
      socket.off('matchFound');
      socket.off('newMessage');
      socket.off('gameEnd');
      socket.off('watchingGame');
      socket.off('gameComplete');
      socket.off('error');
    };
  }, []);

  const handleRoleSelection = (selectedRole) => {
    setRole(selectedRole);
    setStatus('Joining the lobby...');
    socket.emit('joinLobby', { role: selectedRole });
  };
  
  const handleNewGame = (selectedRole) => { // --- NEW: A new function to handle the New Game buttons ---
    setRole(selectedRole);
    setSessionId(null);
    setMessages([]);
    setChatEnded(false);
    setWatchingGame(false);
    setWatchingSessionId(null);
    setStatus('Joining the lobby...');
    
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimeLeft(90);
    
    socket.emit('newGame', { role: selectedRole });
  }

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && sessionId && !chatEnded) {
      const newMessage = { sender: 'you', text: inputMessage };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      socket.emit('sendMessage', { sessionId, message: inputMessage });
      setInputMessage('');
    }
  };

  const handleMakeGuess = (guess) => {
    if (sessionId) {
      socket.emit('makeGuess', { sessionId, guess });
    }
  };

  const renderContent = () => {
    if (!role) {
      return (
        <div>
          <h1>Turing Test Game</h1>
          <p>Welcome to the Turing Test! Your goal is to talk with another player and determine if they are a human or an AI. Select your role to begin.</p>
          <div className="button-container">
            <button onClick={() => handleRoleSelection("tester")}>I want to be the Tester</button>
            <button onClick={() => handleRoleSelection("tested person")}>I want to get Tested</button>
          </div>
        </div>
      );
    }
    else if (watchingGame) {
      return (
        <div className="watching-window">
          <h1>Turing Test Game</h1>
          <h2>🍿 Watching Mode</h2>
          <div className="watching-status">
            <p className="watching-message">You are currently in the queue. The tester is playing with an AI.</p>
            <p className="queue-position">You are next in line!</p>
          </div>
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="message-content">
                  <strong>{msg.sender}:</strong> {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="button-container">
            <button onClick={() => handleNewGame("tester")}>Switch to Tester</button>
            <button onClick={() => handleNewGame("tested person")}>Stay in Queue</button>
          </div>
        </div>
      );
    }
    else if (!sessionId) {
      return (
        <div>
          <h1>Turing Test Game</h1>
          <h2>{status}</h2>
        </div>
      );
    }
    else {
      return (
        <div className="chat-window">
          <h2>Turing Test Chat</h2>
          {!chatEnded && (
            <div className={`timer ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
              Time remaining: {timeLeft}s
            </div>
          )}
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="message-content">
                  <strong>{msg.sender}:</strong> {msg.text}
                </div>
              </div>
            ))}
          </div>
          {chatEnded ? (
            <div>
              {/* --- NEW: Conditionally render the end-game message --- */}
              {gameReason === 'timeout' && (
                <div>
                  <p className="end-message">Time is up! Game has ended. The tester did not make a guess.</p>
                  <div className="button-container">
                    <button onClick={() => handleNewGame("tester")}>Play as Tester</button>
                    <button onClick={() => handleNewGame("tested person")}>Get Tested</button>
                  </div>
                </div>
              )}
              {gameReason === 'readyToGuess' && (
                <p className="end-message">{guessResult}</p>
              )}
              {gameReason === 'guess' && (
                <div>
                  <p className={`result-message ${guessResult && guessResult.includes('incorrectly') ? 'incorrect' : ''}`}>
                    {guessResult}
                  </p>
                  <div className="button-container">
                    <button onClick={() => handleNewGame("tester")}>Play as Tester</button>
                    <button onClick={() => handleNewGame("tested person")}>Get Tested</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSendMessage}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={chatEnded}
              />
              <button type="submit" disabled={chatEnded}>Send</button>
            </form>
          )}
          {/* --- NEW: Show guess buttons only for the tester when ready to guess --- */}
          {chatEnded && role === 'tester' && gameReason === 'readyToGuess' && (
            <div className="guess-buttons">
              <button onClick={() => handleMakeGuess('human')}>Guess: Human</button>
              <button onClick={() => handleMakeGuess('AI')}>Guess: AI</button>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {renderContent()}
      </header>
    </div>
  );
}

export default App;