import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Carregando...');

  useEffect(() => {
    fetch('http://localhost:3001/api/messages')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setMessage(data[0].text);
        } else {
          setMessage('Nenhuma mensagem encontrada');
        }
      })
      .catch(err => {
        console.error(err);
        setMessage('Erro ao conectar com o backend');
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>React + NestJS + PostgreSQL</h1>
        <p>Mensagem: {message}</p>
      </header>
    </div>
  );
}

export default App;
