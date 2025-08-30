/**
 * AI Assistant component for natural language rule queries and game assistance
 */

import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';

export interface AssistantMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    provider?: string;
    model?: string;
    costUSD?: number;
    latencyMs?: number;
  };
}

export interface AIAssistantProps {
  gameSystem?: string;
  campaignId?: string;
  playerLevel?: number;
  characterClass?: string;
  onClose?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({gameSystem = 'D&D 5e', campaignId, playerLevel, characterClass, onClose}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Hello! I'm your D&D 5e rules assistant. I can help you with:
• Rule explanations and clarifications
• Spell descriptions and mechanics
• Combat action suggestions
• Character creation advice
• DM rulings and interpretations

What would you like to know?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: AssistantMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          context: {
            gameSystem,
            campaignId,
            playerLevel,
            characterClass,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get assistant response');
      }

      const data = await response.json();

      const assistantMessage: AssistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: AssistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (_action: string, prompt: string) => {
    setInput(prompt);
    // Trigger form submission
    setTimeout(() => {
      const form = document.querySelector('.ai-assistant-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 100);
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ai-assistant">
      <div className="ai-assistant-header">
        <h3>AI Rules Assistant</h3>
        <div className="ai-assistant-context">
          {gameSystem} • Level {playerLevel} {characterClass}
        </div>
        {onClose && (
          <button className="ai-assistant-close" onClick={onClose} >
            ×
          </button>
        )}
      </div>

      <div className="ai-assistant-quick-actions">
        <button
          onClick={() => handleQuickAction('spell', 'Explain the spell Fireball')}
          className="quick-action-btn"
          tabIndex={0}
        >
          Explain Spell
        </button>
        <button
          onClick={() => handleQuickAction('combat', 'What are my combat options?')}
          className="quick-action-btn"
          tabIndex={0}
        >
          Combat Help
        </button>
        <button
          onClick={() => handleQuickAction('rule', 'How does advantage work?')}
          className="quick-action-btn"
          tabIndex={0}
        >
          Rule Query
        </button>
      </div>

      <div className="ai-assistant-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.type === 'user' ? 'message-user' : 'message-assistant'}`}
          >
            <div className="message-content">
              {message.content.split('\n').map((line, index) => (
                <span key={index}>{line}<br /></span>
              ))}
            </div>
            <div className="message-meta">
              <span className="message-time">{formatTimestamp(message.timestamp)}</span>
              {message.metadata && (
                <span className="message-provider">
                  {message.metadata.provider} • {message.metadata.latencyMs}ms
                  {message.metadata.costUSD && ` • $${message.metadata.costUSD.toFixed(4)}`}
                </span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message message-assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="ai-assistant-form" onSubmit={handleSubmit} role="form">
        <div className="ai-assistant-input-group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about rules, spells, combat, or anything D&D related..."
            className="ai-assistant-input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="ai-assistant-send"
            aria-label="Send message" >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
