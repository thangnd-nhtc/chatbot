import React, { useState } from 'react';
import { Lock, LogIn, ArrowLeft, Bot } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../config';

const LoginView = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const resp = await fetch(`${API_BASE_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (resp.ok) {
                const data = await resp.json();
                localStorage.setItem('admin_token', data.token);
                navigate('/admin');
            } else {
                const errData = await resp.json();
                setError(errData.detail || 'Mật khẩu không chính xác');
            }
        } catch (err) {
            setError('Không thể kết nối đến máy chủ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="petals-container">
                {/* Simple petals for login page */}
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="petal" style={{ left: `${i * 20}%`, animationDuration: '8s' }}></div>)}
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="login-card"
            >
                <div className="login-header">
                    <div className="login-icon">
                        <Lock size={32} />
                    </div>
                    <h1>Quản Trị Hệ Thống</h1>
                    <p>Vui lòng nhập mật khẩu để tiếp tục</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Đang xác thực...' : (
                            <>
                                <LogIn size={20} />
                                Xác Nhận Đăng Nhập
                            </>
                        )}
                    </button>
                </form>

                <Link to="/" className="back-link">
                    <ArrowLeft size={16} />
                    Quay lại trang chủ
                </Link>
            </motion.div>
        </div>
    );
};

export default LoginView;
