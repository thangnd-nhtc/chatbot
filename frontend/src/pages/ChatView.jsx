import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Sparkles, Globe, Trash2, Calendar, Users, Phone, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { sendMessageStreaming } from '../services/ai';
import { API_BASE_URL } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NOTIFY_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

const ChatView = () => {
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('chat_history');
        return saved ? JSON.parse(saved) : [
            { id: 1, text: "Chúc mừng năm mới! Tôi là trợ lý AI chuyên trách nhân sự NHTC. Bạn cần tôi hỗ trợ gì hôm nay?", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ];
    });

    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [streamingId, setStreamingId] = useState(null);
    const [isWebSearch, setIsWebSearch] = useState(false);
    const [deviceId] = useState(() => {
        let id = localStorage.getItem('device_id');
        if (!id) {
            id = 'device_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('device_id', id);
        }
        return id;
    });

    const messagesEndRef = useRef(null);
    const audioRef = useRef(new Audio(NOTIFY_SOUND));

    const suggestions = [
        { label: "Lịch nghỉ Tết", icon: <Calendar size={14} />, query: "Lịch nghỉ Tết âm lịch năm nay như thế nào?" },
        { label: "Phòng R&D", icon: <Users size={14} />, query: "Liệt kê danh sách nhân sự phòng R&D dưới dạng bảng" },
        { label: "Tìm SĐT", icon: <Phone size={14} />, query: "Cho tôi xin số điện thoại của anh Bùi Trung Hiếu" }
    ];

    const petals = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${6 + Math.random() * 4}s`,
        size: `${Math.random() * 15 + 10}px`
    })), []);

    const [isInitialMount, setIsInitialMount] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollAreaRef = useRef(null);

    const scrollToBottom = (behavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    // Theo dõi hành vi cuộn của người dùng
    const handleScroll = () => {
        if (scrollAreaRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
            // Nếu cách đáy dưới 100px thì coi như đang ở đáy
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
            setAutoScroll(isAtBottom);
        }
    };

    useEffect(() => {
        if (isInitialMount) {
            setIsInitialMount(false);
            // Không cuộn tự động lần đầu khi load history, để người dùng tự xem
            return;
        }

        // Chỉ tự động cuộn nếu người dùng đang ở đáy hoặc bot đang trả lời
        if (autoScroll || isTyping) {
            scrollToBottom(isTyping ? "auto" : "smooth"); // Dùng auto khi streaming để mượt hơn
        }

        localStorage.setItem('chat_history', JSON.stringify(messages));
    }, [messages, isTyping]);

    const clearHistory = () => {
        if (window.confirm("Bạn có muốn xóa toàn bộ lịch sử trò chuyện?")) {
            setMessages([{ id: Date.now(), text: "Lịch sử đã được dọn dẹp. Tôi có thể giúp gì tiếp cho bạn?", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
            localStorage.removeItem('chat_history');
        }
    };

    const handleSendMessage = async (e, forcedText = null) => {
        if (e) e.preventDefault();
        const text = forcedText || inputValue;
        if (!text.trim() || isTyping) return;

        const userMsg = { id: Date.now(), text, sender: 'user', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const botMsgId = Date.now() + 1;
            setStreamingId(botMsgId);

            const audio = audioRef.current;
            audio.volume = 0.3;
            audio.play().catch(() => { });

            setMessages(prev => [...prev, { id: botMsgId, text: "", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);

            await sendMessageStreaming(
                messages,
                text,
                `${API_BASE_URL}/v1`,
                "vinallama",
                isWebSearch,
                deviceId,
                (accumulatedText) => {
                    setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: accumulatedText } : m));
                }
            );
        } catch (error) {
            console.error("Lỗi:", error);
            setMessages(prev => [...prev, { id: Date.now(), text: "Xin lỗi, đã có lỗi kết nối đến hệ thống AI.", sender: 'bot', isError: true }]);
        } finally {
            setIsTyping(false);
            setStreamingId(null);
        }
    };

    return (
        <div className="chat-view">
            {/* Decorative Trees */}
            <div className="mai-tree-left"></div>
            <div className="dao-tree-right"></div>

            {/* Decorative Floating Petals */}
            <div className="petals-container">
                {petals.map(p => (
                    <div key={p.id} className="petal" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, width: p.size, height: p.size }}></div>
                ))}
            </div>

            <div className="chat-card">
                {/* Header */}
                <div className="chat-header">
                    <div className="bot-avatar-container">
                        <img src="/logo.png" alt="Logo" className="bot-logo" />
                        <div className="bot-status"></div>
                    </div>
                    <div className="header-info">
                        <h1>Cung Chúc Tân Xuân</h1>
                        <p>{streamingId || isTyping ? 'Đang soạn thảo...' : 'Trợ lý NHTC luôn sẵn sàng'}</p>
                    </div>
                    <div className="header-actions">
                        <button className="icon-btn" onClick={clearHistory} title="Xóa lịch sử">
                            <Trash2 size={20} />
                        </button>
                        <Link to="/login" className="icon-btn" title="Trang Quản Trị">
                            <Settings size={20} />
                        </Link>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    className="messages-area"
                    ref={scrollAreaRef}
                    onScroll={handleScroll}
                >
                    <AnimatePresence mode='popLayout'>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`message-wrapper ${msg.sender}`}
                            >
                                <div className="avatar">
                                    {msg.sender === 'bot' ? <Bot size={18} /> : <User size={18} />}
                                </div>
                                <div className="message-content">
                                    <div className="bubble">
                                        {msg.sender === 'bot' ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => (
                                                        <div className="table-container">
                                                            <table {...props} />
                                                        </div>
                                                    )
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.text
                                        )}
                                        {msg.id === streamingId && (
                                            <motion.span
                                                animate={{ opacity: [0, 1, 0] }}
                                                transition={{ repeat: Infinity, duration: 0.8 }}
                                                className="cursor"
                                            />
                                        )}
                                    </div>
                                    <span className="timestamp">{msg.timestamp}</span>
                                </div>
                            </motion.div>
                        ))}

                        {isTyping && !streamingId && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="message-wrapper bot typing"
                            >
                                <div className="avatar"><Bot size={18} /></div>
                                <div className="bubble typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="input-area">
                    {/* Suggestions Layer */}
                    {!streamingId && !isTyping && messages.length < 5 && (
                        <div className="suggestions-container">
                            {suggestions.map((s, idx) => (
                                <button
                                    key={idx}
                                    className="suggestion-chip"
                                    onClick={() => handleSendMessage(null, s.query)}
                                >
                                    {s.icon} {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <form className="input-container" onSubmit={handleSendMessage}>
                        <button
                            type="button"
                            className={`search-toggle-btn ${isWebSearch ? 'active' : ''}`}
                            onClick={() => setIsWebSearch(!isWebSearch)}
                            title={isWebSearch ? "Đang bật tìm kiếm Web" : "Nhấn để tìm kiếm Web"}
                        >
                            <Globe size={22} />
                            {isWebSearch && <span className="search-label">Web</span>}
                        </button>
                        <input
                            type="text"
                            className="chat-input"
                            placeholder={isWebSearch ? "Tìm kiếm trên internet..." : "Hỏi về nhân sự công ty..."}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <button type="submit" className="send-button" disabled={!inputValue.trim() || isTyping || streamingId}>
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
