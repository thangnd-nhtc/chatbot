import React, { useState, useEffect } from 'react';
import { Trash2, Upload, RefreshCw, AlertCircle, FileText, Home, LogOut, UserPlus, Save, CheckCircle, Building, Phone, Mail, Briefcase, Megaphone, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

const AdminView = () => {
    const [adminFiles, setAdminFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [isSavingEmployee, setIsSavingEmployee] = useState(false);
    const [isSavingNews, setIsSavingNews] = useState(false);
    const [saveEmployeeSuccess, setSaveEmployeeSuccess] = useState(false);
    const [saveNewsSuccess, setSaveNewsSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState('employee'); // 'employee', 'news', or 'chatlogs'
    const [chatLogFiles, setChatLogFiles] = useState([]);
    const [selectedLogContent, setSelectedLogContent] = useState(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const navigate = useNavigate();

    // Form state for new employee
    const [employeeForm, setEmployeeForm] = useState({
        hoTen: '',
        phongBan: '',
        chucVu: '',
        soDienThoai: '',
        email: '',
        ngaySinh: '',
        queQuan: '',
        ngayVaoLam: '',
        ghiChu: ''
    });

    // Form state for news/announcement
    const [newsForm, setNewsForm] = useState({
        tieuDe: '',
        loaiThongBao: 'Thông báo chung',
        ngayApDung: '',
        ngayKetThuc: '',
        noiDung: '',
        doiTuong: 'Toàn công ty'
    });

    const getAuthHeaders = () => {
        const token = localStorage.getItem('admin_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const fetchFiles = async () => {
        try {
            const resp = await fetch(`${API_URL}/admin/files`, {
                headers: getAuthHeaders()
            });
            if (resp.status === 401) {
                handleLogout();
                return;
            }
            const data = await resp.json();
            setAdminFiles(data);
        } catch (e) {
            console.error("Lỗi lấy danh sách file:", e);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('admin_token');
            const resp = await fetch(`${API_URL}/admin/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (resp.status === 401) {
                handleLogout();
                return;
            }
            fetchFiles();
        } catch (e) {
            console.error("Lỗi upload:", e);
        } finally {
            setIsUploading(false);
        }
    };

    const deleteFile = async (name) => {
        if (!window.confirm(`Bạn chắc chắn muốn xóa vĩnh viễn tệp: ${name}?`)) return;
        try {
            const resp = await fetch(`${API_URL}/admin/files/${name}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (resp.status === 401) {
                handleLogout();
                return;
            }
            fetchFiles();
        } catch (e) {
            console.error("Lỗi xóa file:", e);
        }
    };

    const rebuildRag = async () => {
        setIsRebuilding(true);
        try {
            const resp = await fetch(`${API_URL}/admin/rebuild-rag`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (resp.status === 401) {
                handleLogout();
                return;
            }
            const data = await resp.json();
            if (data.status === 'rebuilt') {
                alert("Bộ não AI đã được cập nhật dữ liệu mới!");
            }
        } catch (e) {
            console.error("Lỗi rebuild:", e);
        } finally {
            setIsRebuilding(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        navigate('/login');
    };

    const handleEmployeeFormChange = (e) => {
        const { name, value } = e.target;
        setEmployeeForm(prev => ({ ...prev, [name]: value }));
    };

    const handleNewsFormChange = (e) => {
        const { name, value } = e.target;
        setNewsForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEmployee = async (e) => {
        e.preventDefault();

        if (!employeeForm.hoTen || !employeeForm.phongBan || !employeeForm.chucVu) {
            alert("Vui lòng điền đầy đủ: Họ tên, Phòng ban và Chức vụ!");
            return;
        }

        setIsSavingEmployee(true);
        setSaveEmployeeSuccess(false);

        try {
            const resp = await fetch(`${API_URL}/admin/add-employee`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(employeeForm)
            });

            if (resp.status === 401) {
                handleLogout();
                return;
            }

            const data = await resp.json();
            if (data.status === 'success') {
                setSaveEmployeeSuccess(true);
                setEmployeeForm({
                    hoTen: '',
                    phongBan: '',
                    chucVu: '',
                    soDienThoai: '',
                    email: '',
                    ngaySinh: '',
                    queQuan: '',
                    ngayVaoLam: '',
                    ghiChu: ''
                });
                setTimeout(() => setSaveEmployeeSuccess(false), 3000);
            }
        } catch (e) {
            console.error("Lỗi lưu nhân viên:", e);
            alert("Có lỗi xảy ra khi lưu thông tin!");
        } finally {
            setIsSavingEmployee(false);
        }
    };

    const handleSaveNews = async (e) => {
        e.preventDefault();

        if (!newsForm.tieuDe || !newsForm.noiDung) {
            alert("Vui lòng điền đầy đủ: Tiêu đề và Nội dung thông báo!");
            return;
        }

        setIsSavingNews(true);
        setSaveNewsSuccess(false);

        try {
            const resp = await fetch(`${API_URL}/admin/add-news`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newsForm)
            });

            if (resp.status === 401) {
                handleLogout();
                return;
            }

            const data = await resp.json();
            if (data.status === 'success') {
                setSaveNewsSuccess(true);
                setNewsForm({
                    tieuDe: '',
                    loaiThongBao: 'Thông báo chung',
                    ngayApDung: '',
                    ngayKetThuc: '',
                    noiDung: '',
                    doiTuong: 'Toàn công ty'
                });
                setTimeout(() => setSaveNewsSuccess(false), 3000);
            }
        } catch (e) {
            console.error("Lỗi lưu thông báo:", e);
            alert("Có lỗi xảy ra khi lưu thông báo!");
        } finally {
            setIsSavingNews(false);
        }
    };

    const fetchChatLogFiles = async () => {
        setIsLoadingLogs(true);
        try {
            const resp = await fetch(`${API_URL}/admin/chat_logs`, {
                headers: getAuthHeaders()
            });
            if (resp.ok) {
                const data = await resp.json();
                setChatLogFiles(data);
            }
        } catch (e) {
            console.error("Lỗi lấy danh sách log:", e);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const viewLogContent = async (filename) => {
        setIsLoadingLogs(true);
        try {
            const resp = await fetch(`${API_URL}/admin/chat_logs/${filename}`, {
                headers: getAuthHeaders()
            });
            if (resp.ok) {
                const data = await resp.json();
                setSelectedLogContent({ name: filename, entries: data });
            }
        } catch (e) {
            console.error("Lỗi lấy nội dung log:", e);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'chatlogs') {
            fetchChatLogFiles();
        } else {
            fetchFiles();
        }
    }, [activeTab]);

    const handleDrag = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload(e);
    };

    return (
        <div className="admin-page-container">
            <div className="admin-sidebar">
                <div className="sidebar-logo">
                    <img src="/logo.png" alt="Logo" className="sidebar-logo-img" />
                    <span>Admin Panel</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/" className="nav-item">
                        <Home size={20} />
                        <span>Về Trang Chủ</span>
                    </Link>
                    <div className="nav-item active">
                        <FileText size={20} />
                        <span>Quản Lý Dữ Liệu</span>
                    </div>
                    <button onClick={handleLogout} className="nav-item logout-nav-btn">
                        <LogOut size={20} />
                        <span>Đăng Xuất</span>
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <p>© 2026 Chatbot Pro</p>
                </div>
            </div>

            <div className="admin-main-content">
                <header className="admin-top-bar">
                    <div className="top-bar-left">
                        <h2>Quản Lý Cơ Sở Tri Thức AI</h2>
                        <p>Bồi dưỡng kiến thức cho Chatbot bằng cách thêm dữ liệu mới.</p>
                    </div>
                    <button className={`rebuild-btn-large ${isRebuilding ? 'loading' : ''}`} onClick={rebuildRag} disabled={isRebuilding}>
                        <RefreshCw size={20} className={isRebuilding ? 'spin' : ''} />
                        <span>{isRebuilding ? 'Đang Huấn Luyện AI...' : 'Làm Mới Bộ Não AI'}</span>
                    </button>
                </header>

                {/* Tab Switcher */}
                <div className="data-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'employee' ? 'active' : ''}`}
                        onClick={() => setActiveTab('employee')}
                    >
                        <UserPlus size={18} />
                        <span>Thêm Nhân Sự</span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
                        onClick={() => setActiveTab('news')}
                    >
                        <Megaphone size={18} />
                        <span>Thêm Thông Báo / Tin Tức</span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'chatlogs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chatlogs')}
                    >
                        <FileText size={18} />
                        <span>Lịch Sử Chat</span>
                    </button>
                </div>

                {/* Employee Form Section */}
                {activeTab === 'employee' && (
                    <section className="admin-card data-form-card">
                        <div className="card-header">
                            <h3><UserPlus size={22} className="text-red" /> Thêm Thông Tin Nhân Sự Mới</h3>
                            <p className="card-subtitle">Điền thông tin theo mẫu dưới đây để AI học được đầy đủ và chính xác nhất</p>
                        </div>

                        <form onSubmit={handleSaveEmployee} className="data-form">
                            <div className="form-grid">
                                <div className="form-group required">
                                    <label><UserPlus size={16} /> Họ và Tên *</label>
                                    <input
                                        type="text"
                                        name="hoTen"
                                        value={employeeForm.hoTen}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="Nguyễn Văn An"
                                    />
                                </div>

                                <div className="form-group required">
                                    <label><Building size={16} /> Phòng Ban *</label>
                                    <input
                                        type="text"
                                        name="phongBan"
                                        value={employeeForm.phongBan}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="Phòng R&D"
                                    />
                                </div>

                                <div className="form-group required">
                                    <label><Briefcase size={16} /> Chức Vụ *</label>
                                    <input
                                        type="text"
                                        name="chucVu"
                                        value={employeeForm.chucVu}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="Trưởng phòng"
                                    />
                                </div>

                                <div className="form-group">
                                    <label><Phone size={16} /> Số Điện Thoại</label>
                                    <input
                                        type="text"
                                        name="soDienThoai"
                                        value={employeeForm.soDienThoai}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="0901234567"
                                    />
                                </div>

                                <div className="form-group">
                                    <label><Mail size={16} /> Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={employeeForm.email}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="nvan@company.com"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Ngày Sinh</label>
                                    <input
                                        type="date"
                                        name="ngaySinh"
                                        value={employeeForm.ngaySinh}
                                        onChange={handleEmployeeFormChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Quê Quán</label>
                                    <input
                                        type="text"
                                        name="queQuan"
                                        value={employeeForm.queQuan}
                                        onChange={handleEmployeeFormChange}
                                        placeholder="Hà Nội"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Ngày Vào Làm</label>
                                    <input
                                        type="date"
                                        name="ngayVaoLam"
                                        value={employeeForm.ngayVaoLam}
                                        onChange={handleEmployeeFormChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group full-width">
                                <label>Ghi Chú / Thông Tin Bổ Sung</label>
                                <textarea
                                    name="ghiChu"
                                    value={employeeForm.ghiChu}
                                    onChange={handleEmployeeFormChange}
                                    placeholder="Thông tin đặc biệt, kỹ năng chuyên môn, chứng chỉ..."
                                    rows={3}
                                />
                            </div>

                            <div className="form-actions">
                                {saveEmployeeSuccess && (
                                    <div className="success-message">
                                        <CheckCircle size={18} />
                                        <span>Đã lưu thành công! Hãy nhấn "Làm Mới Bộ Não AI" để cập nhật.</span>
                                    </div>
                                )}
                                <button type="submit" className="save-btn green" disabled={isSavingEmployee}>
                                    {isSavingEmployee ? (
                                        <>
                                            <RefreshCw size={18} className="spin" />
                                            <span>Đang Lưu...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            <span>Lưu Thông Tin Nhân Sự</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* News/Announcements Form Section */}
                {activeTab === 'news' && (
                    <section className="admin-card data-form-card news-form-card">
                        <div className="card-header">
                            <h3><Megaphone size={22} className="text-gold" /> Thêm Thông Báo / Tin Tức Mới</h3>
                            <p className="card-subtitle">Tạo thông báo nội bộ như lịch nghỉ Tết, sự kiện, chính sách mới...</p>
                        </div>

                        <form onSubmit={handleSaveNews} className="data-form">
                            <div className="form-grid">
                                <div className="form-group required full-width">
                                    <label><Megaphone size={16} /> Tiêu Đề Thông Báo *</label>
                                    <input
                                        type="text"
                                        name="tieuDe"
                                        value={newsForm.tieuDe}
                                        onChange={handleNewsFormChange}
                                        placeholder="VD: Thông báo lịch nghỉ Tết Ất Tỵ 2025"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Loại Thông Báo</label>
                                    <select
                                        name="loaiThongBao"
                                        value={newsForm.loaiThongBao}
                                        onChange={handleNewsFormChange}
                                    >
                                        <option value="Thông báo chung">📢 Thông báo chung</option>
                                        <option value="Lịch nghỉ lễ">🎉 Lịch nghỉ lễ</option>
                                        <option value="Sự kiện công ty">🎊 Sự kiện công ty</option>
                                        <option value="Chính sách mới">📋 Chính sách mới</option>
                                        <option value="Thông báo khẩn">🚨 Thông báo khẩn</option>
                                        <option value="Tin tức nội bộ">📰 Tin tức nội bộ</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Áp Dụng Cho</label>
                                    <select
                                        name="doiTuong"
                                        value={newsForm.doiTuong}
                                        onChange={handleNewsFormChange}
                                    >
                                        <option value="Toàn công ty">Toàn công ty</option>
                                        <option value="Ban Giám đốc">Ban Giám đốc</option>
                                        <option value="Phòng R&D">Phòng R&D</option>
                                        <option value="Phòng Kinh doanh">Phòng Kinh doanh</option>
                                        <option value="Phòng Nhân sự">Phòng Nhân sự</option>
                                        <option value="Phòng Kế toán">Phòng Kế toán</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label><Calendar size={16} /> Ngày Bắt Đầu</label>
                                    <input
                                        type="date"
                                        name="ngayApDung"
                                        value={newsForm.ngayApDung}
                                        onChange={handleNewsFormChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label><Calendar size={16} /> Ngày Kết Thúc</label>
                                    <input
                                        type="date"
                                        name="ngayKetThuc"
                                        value={newsForm.ngayKetThuc}
                                        onChange={handleNewsFormChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group full-width">
                                <label>Nội Dung Chi Tiết *</label>
                                <textarea
                                    name="noiDung"
                                    value={newsForm.noiDung}
                                    onChange={handleNewsFormChange}
                                    placeholder="VD: Công ty thông báo lịch nghỉ Tết Nguyên Đán từ ngày 25/01/2025 đến hết ngày 02/02/2025. Toàn thể CBNV quay lại làm việc vào ngày 03/02/2025..."
                                    rows={5}
                                />
                            </div>

                            <div className="form-actions">
                                {saveNewsSuccess && (
                                    <div className="success-message">
                                        <CheckCircle size={18} />
                                        <span>Đã lưu thông báo! Hãy nhấn "Làm Mới Bộ Não AI" để cập nhật.</span>
                                    </div>
                                )}
                                <button type="submit" className="save-btn gold" disabled={isSavingNews}>
                                    {isSavingNews ? (
                                        <>
                                            <RefreshCw size={18} className="spin" />
                                            <span>Đang Lưu...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Megaphone size={18} />
                                            <span>Đăng Thông Báo</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* Chat Logs Section */}
                {activeTab === 'chatlogs' && (
                    <section className="admin-card logs-section">
                        <div className="card-header">
                            <h3><FileText size={22} className="text-gold" /> Nhật ký hội thoại của Bot</h3>
                            <button className="icon-btn" onClick={fetchChatLogFiles} title="Làm mới">
                                <RefreshCw size={20} className={isLoadingLogs ? "spin" : ""} />
                            </button>
                        </div>

                        <div className="logs-container">
                            {!selectedLogContent ? (
                                <div className="logs-list">
                                    {chatLogFiles.length === 0 ? (
                                        <div className="empty-state">
                                            <AlertCircle size={40} />
                                            <p>Chưa có lịch sử chat nào được ghi nhận.</p>
                                        </div>
                                    ) : (
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Tên tệp nhật ký</th>
                                                    <th>Kích thước</th>
                                                    <th>Cập nhật cuối</th>
                                                    <th>Hành động</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chatLogFiles.map((file, idx) => (
                                                    <tr key={idx}>
                                                        <td className="font-bold">{file.name}</td>
                                                        <td>{(file.size / 1024).toFixed(1)} KB</td>
                                                        <td>{file.modified}</td>
                                                        <td>
                                                            <button className="view-btn" onClick={() => viewLogContent(file.name)}>
                                                                Xem chi tiết
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ) : (
                                <div className="log-details">
                                    <div className="log-details-header">
                                        <button className="back-btn" onClick={() => setSelectedLogContent(null)}>
                                            ← Quay lại danh sách
                                        </button>
                                        <h4>Chi tiết tệp: {selectedLogContent.name}</h4>
                                    </div>
                                    <div className="log-entries">
                                        {selectedLogContent.entries.map((entry, idx) => (
                                            <div key={idx} className="log-entry-card">
                                                <div className="entry-meta">
                                                    <span className="entry-time">{entry.timestamp}</span>
                                                    <span className="entry-device">ID: {entry.device_id}</span>
                                                </div>
                                                <div className="entry-content">
                                                    <div className="user-q">
                                                        <strong>👤 User:</strong> {entry.user_query}
                                                    </div>
                                                    <div className="bot-a">
                                                        <strong>🤖 Bot:</strong> {entry.bot_response}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {(activeTab === 'employee' || activeTab === 'news') && (
                    <div className="admin-grid">
                        <section className="admin-card">
                            <div className="card-header">
                                <h3>Tài Liệu Hiện Có ({adminFiles.length})</h3>
                            </div>
                            <div className="file-table-container">
                                <table className="admin-file-table">
                                    <thead>
                                        <tr>
                                            <th>Tên Tệp</th>
                                            <th>Dung Lượng</th>
                                            <th>Ngày Cập Nhật</th>
                                            <th>Hành Động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminFiles.length === 0 ? (
                                            <tr><td colSpan="4" className="empty-row">Chưa có dữ liệu nào được tải lên.</td></tr>
                                        ) : (
                                            adminFiles.map(f => (
                                                <tr key={f.name}>
                                                    <td className="file-name-cell">
                                                        <FileText size={16} className="text-gold" />
                                                        {f.name}
                                                    </td>
                                                    <td>{(f.size / 1024).toFixed(1)} KB</td>
                                                    <td>{new Date(f.modified * 1000).toLocaleString('vi-VN')}</td>
                                                    <td>
                                                        <button className="delete-btn-table" onClick={() => deleteFile(f.name)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="admin-card">
                            <div className="card-header">
                                <h3>Tải Lên Tài Liệu Mới</h3>
                            </div>
                            <div className={`drop-zone ${dragActive ? 'active' : ''} ${isUploading ? 'uploading' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
                                <Upload size={48} className="upload-icon-large" />
                                <h4>{isUploading ? 'Đang Xử Lý...' : 'Kéo thả tệp vào đây'}</h4>
                                <p>Hỗ trợ: PDF, Excel, Word, TXT, CSV</p>
                                <label className="browse-btn">
                                    <span>Chọn từ máy tính</span>
                                    <input type="file" onChange={handleFileUpload} hidden disabled={isUploading} />
                                </label>
                            </div>
                            <div className="status-notice">
                                <AlertCircle size={18} />
                                <p>Lưu ý: Sau khi thêm dữ liệu, nhấn nút <b>"Làm Mới Bộ Não AI"</b>.</p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminView;
