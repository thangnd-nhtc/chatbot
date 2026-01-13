from fastapi import FastAPI, HTTPException, Body, File, UploadFile, Depends, Header
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import shutil
import google.generativeai as genai
from pathlib import Path
from rag import get_rag_retriever, get_vector_store
from langchain_community.tools import DuckDuckGoSearchRun

search_tool = DuckDuckGoSearchRun()

app = FastAPI()

# Config
DATA_DIR = Path("../data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_DIR = Path("./chroma_db_v3")
LOGS_DIR = Path("./chat_logs")
LOGS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_GOOGLE_CHAT_SPACE = "ALL"  # Tạm thời để ALL để kiểm tra cấu hình
# Gemini Config
GEMINI_API_KEY = "AIzaSyAKskIgcKW2hIT3VaVpedFBAsTPrBciPgI"
genai.configure(api_key=GEMINI_API_KEY)
# Using gemma-3-27b-it as Gemini 2.x models are out of quota
GEMINI_MODEL_NAME = "gemma-3-27b-it" 

# Security - Simple Hardcoded for local use
ADMIN_PASSWORD = "admin" # USER can change this
SECRET_TOKEN = "nhtc-secret-admin-token-2026"

_global_retriever = None

@app.get("/")
async def root():
    return {"message": "NHTC Bot Backend is Running!"}

@app.on_event("startup")
async def startup_event():
    global _global_retriever
    print("--- KHỞI TẠO HỆ THỐNG RAG ---")
    _global_retriever = get_rag_retriever()
    print("--- RAG ĐÃ SẴN SÀNG ---")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "local-model"
    messages: List[Message]
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False
    device_id: Optional[str] = "unknown"
    search_web: Optional[bool] = False

class LoginRequest(BaseModel):
    password: str

class EmployeeData(BaseModel):
    hoTen: str
    phongBan: str
    chucVu: str
    soDienThoai: Optional[str] = ""
    email: Optional[str] = ""
    ngaySinh: Optional[str] = ""
    queQuan: Optional[str] = ""
    ngayVaoLam: Optional[str] = ""
    ghiChu: Optional[str] = ""

# Auth Dependency
async def verify_admin(authorization: str = Header(None)):
    if authorization != f"Bearer {SECRET_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

# --- AUTH ENDPOINTS ---

@app.post("/admin/login")
async def login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD:
        return {"token": SECRET_TOKEN}
    raise HTTPException(status_code=401, detail="Mật khẩu không chính xác")

# --- ADD EMPLOYEE ENDPOINT ---

@app.post("/admin/add-employee")
async def add_employee(employee: EmployeeData, auth: bool = Depends(verify_admin)):
    """Lưu thông tin nhân viên mới vào file để RAG học"""
    try:
        employee_file = DATA_DIR / "employees_manual.txt"
        
        from datetime import datetime
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        
        # Format data for RAG learning
        content = f"""
---
HỌ VÀ TÊN: {employee.hoTen}
PHÒNG BAN: {employee.phongBan}
CHỨC VỤ: {employee.chucVu}
SỐ ĐIỆN THOẠI: {employee.soDienThoai or 'Chưa cập nhật'}
EMAIL: {employee.email or 'Chưa cập nhật'}
NGÀY SINH: {employee.ngaySinh or 'Chưa cập nhật'}
QUÊ QUÁN: {employee.queQuan or 'Chưa cập nhật'}
NGÀY VÀO LÀM: {employee.ngayVaoLam or 'Chưa cập nhật'}
GHI CHÚ: {employee.ghiChu or 'Không có'}
NGÀY CẬP NHẬT HỆ THỐNG: {now_str}
---
"""
        
        # Append to file
        with open(employee_file, "a", encoding="utf-8") as f:
            f.write(content)
            
        # Tự động cập nhật bộ não RAG (Live Update)
        if _global_retriever:
            from langchain_core.documents import Document
            new_doc = Document(
                page_content=content,
                metadata={
                    "name": employee.hoTen.lower(),
                    "dept": employee.phongBan.lower(),
                    "doc_type": "parent",
                    "source": "manual_add"
                }
            )
            _global_retriever.vectorstore.add_documents([new_doc])
            print(f"[LIVE UPDATE] Đã nạp nhân sự mới: {employee.hoTen}")
        
        return {"status": "success", "message": f"Đã lưu thông báo và cập nhật RAG cho {employee.hoTen}"}
    except Exception as e:
        print(f"Error adding employee: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- News/Announcements Data Model ---

class NewsData(BaseModel):
    tieuDe: str
    loaiThongBao: Optional[str] = "Thông báo chung"
    ngayApDung: Optional[str] = ""
    ngayKetThuc: Optional[str] = ""
    noiDung: str
    doiTuong: Optional[str] = "Toàn công ty"

# --- ADD NEWS ENDPOINT ---

@app.post("/admin/add-news")
async def add_news(news: NewsData, auth: bool = Depends(verify_admin)):
    """Lưu thông báo/tin tức mới vào file để RAG học"""
    try:
        news_file = DATA_DIR / "news_announcements.txt"
        
        from datetime import datetime
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

        # Format data for RAG learning
        content = f"""
===== THÔNG BÁO =====
TIÊU ĐỀ: {news.tieuDe}
LOẠI: {news.loaiThongBao}
ÁP DỤNG CHO: {news.doiTuong}
NGÀY BẮT ĐẦU: {news.ngayApDung or 'Không xác định'}
NGÀY KẾT THÚC: {news.ngayKetThuc or 'Không xác định'}
NGÀY ĐĂNG: {now_str}
NỘI DUNG:
{news.noiDung}
=====================

"""
        
        # Append to file
        with open(news_file, "a", encoding="utf-8") as f:
            f.write(content)
            
        # Tự động cập nhật bộ não RAG (Live Update)
        if _global_retriever:
            from langchain_core.documents import Document
            new_doc = Document(
                page_content=content,
                metadata={
                    "source": "news_announcements.txt",
                    "doc_type": "announce",
                    "title": news.tieuDe.lower()
                }
            )
            _global_retriever.vectorstore.add_documents([new_doc])
            print(f"[LIVE UPDATE] Đã nạp thông báo mới: {news.tieuDe}")
        
        return {"status": "success", "message": f"Đã lưu thông báo và cập nhật RAG: {news.tieuDe}"}
    except Exception as e:
        print(f"Error adding news: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- GOOGLE CHAT WEBHOOK ---

from fastapi import BackgroundTasks

def sync_google_chat_to_rag(text, space_id, received_at):
    """
    Hàm chạy ngầm để đồng bộ dữ liệu vào RAG, tránh làm Google Chat chờ lâu.
    """
    try:
        content = f"\n---\nNGUỒN: Google Chat\nNGÀY NHẬN: {received_at}\nPHÒNG: {space_id}\nNỘI DUNG: {text}\n---\n"
        
        # 1. Lưu vào file log
        sync_file = DATA_DIR / "google_chat_sync.txt"
        with open(sync_file, "a", encoding="utf-8") as f:
            f.write(content)
            
        # 2. Update Vector Store
        global _global_retriever
        if _global_retriever:
            from langchain_core.documents import Document
            new_doc = Document(
                page_content=content,
                metadata={
                    "source": "google_chat",
                    "doc_type": "announce",
                    "space_id": space_id,
                    "received_at": received_at
                }
            )
            _global_retriever.vectorstore.add_documents([new_doc])
            print(f"[GOOGLE CHAT SYNC] Live Update RAG thành công cho tin: {text[:30]}...")
    except Exception as e:
        print(f"[GOOGLE CHAT SYNC ERROR] {e}")

@app.post("/v1/google-chat/webhook")
async def google_chat_webhook(background_tasks: BackgroundTasks, request_body: dict = Body(None)):
    """
    Nhận tin nhắn từ Google Chat - Phản hồi ngay lập tức để tránh timeout
    """
    # TRẢ LỜI NGAY LẬP TỨC - Không parse gì cả
    from datetime import datetime
    now_str = datetime.now().strftime("%H:%M:%S")
    
    # Chạy parsing và lưu dữ liệu ở background
    background_tasks.add_task(process_google_chat_message, request_body)
    
    # Trả về ngay để Google Chat không timeout
    return {"text": f"✅ Bot NHTC đã nhận tin lúc {now_str}"}

def process_google_chat_message(request_body):
    """
    Xử lý tin nhắn Google Chat ở background - không ảnh hưởng response time
    """
    try:
        if not request_body:
            print("[WEBHOOK] Empty body")
            return

        print(f"--- PROCESSING GOOGLE CHAT MESSAGE ---")
        
        # Tìm space_id và text trong cấu trúc Workspace Add-on
        space_id = "unknown"
        text = None
        
        # Cấu trúc Workspace Add-on: chat.messagePayload
        if 'chat' in request_body and 'messagePayload' in request_body['chat']:
            payload = request_body['chat']['messagePayload']
            
            # Lấy space
            if 'space' in payload:
                space_id = payload['space'].get('name', 'unknown')
            
            # Lấy text từ message
            if 'message' in payload:
                message = payload['message']
                text = message.get('text') or message.get('argumentText')
        
        # Fallback: Cấu trúc cũ
        if not text or space_id == "unknown":
            if 'chat' in request_body:
                chat = request_body['chat']
                if 'message' in chat:
                    msg = chat['message']
                    if not text:
                        text = msg.get('text')
                    if space_id == "unknown" and 'space' in msg:
                        space_id = msg['space'].get('name', 'unknown')
        
        print(f"[PARSED] Space: {space_id} | Text: {text}")
        
        # Kiểm tra filter
        if ALLOWED_GOOGLE_CHAT_SPACE != "ALL" and space_id != ALLOWED_GOOGLE_CHAT_SPACE:
            print(f"[FILTERED] Space {space_id} not allowed")
            return
        
        if not text:
            print("[SKIP] No text content")
            return
        
        # Lưu vào RAG
        from datetime import datetime
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        sync_google_chat_to_rag(text, space_id, now_str)
        
    except Exception as e:
        print(f"[ERROR] Processing message: {e}")
        import traceback
        traceback.print_exc()

# --- ADMIN ENDPOINTS (Protected) ---

@app.get("/admin/files")
async def list_files(auth: bool = Depends(verify_admin)):
    files = []
    if DATA_DIR.exists():
        for f in os.listdir(DATA_DIR):
            path = DATA_DIR / f
            files.append({
                "name": f,
                "size": os.path.getsize(path),
                "modified": os.path.getmtime(path)
            })
    return files

@app.post("/admin/upload")
async def upload_file(file: UploadFile = File(...), auth: bool = Depends(verify_admin)):
    file_path = DATA_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename, "status": "success"}

@app.delete("/admin/files/{filename}")
async def delete_file(filename: str, auth: bool = Depends(verify_admin)):
    file_path = DATA_DIR / filename
    if file_path.exists():
        os.remove(file_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/admin/rebuild-rag")
async def rebuild_rag(auth: bool = Depends(verify_admin)):
    global _global_retriever
    print("--- ĐANG XÂY DỰNG LẠI BỘ NÃO RAG ---")
    get_vector_store(force_reload=True)
    _global_retriever = get_rag_retriever()
    return {"status": "rebuilt"}

# --- CHAT LOGGING FUNCTION ---
def save_chat_log(device_id: str, user_query: str, bot_response: str):
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_file_path = LOGS_DIR / f"chat_log_{datetime.now().strftime('%Y%m%d')}.jsonl"
        
        log_entry = {
            "timestamp": timestamp,
            "device_id": device_id,
            "user_query": user_query,
            "bot_response": bot_response
        }
        
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        print(f"[CHAT LOG] Logged chat for device_id: {device_id}")
    except Exception as e:
        print(f"[CHAT LOG ERROR] Could not save chat log: {e}")

# --- ADMIN CHAT LOG ENDPOINTS ---

@app.get("/admin/chat_logs")
async def get_chat_log_files(auth: bool = Depends(verify_admin)):
    """Liệt kê các tệp nhật ký chat"""
    files = []
    if LOGS_DIR.exists():
        for f in LOGS_DIR.glob("*.jsonl"):
            files.append({
                "name": f.name,
                "size": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d/%m/%Y %H:%M")
            })
    return sorted(files, key=lambda x: x["name"], reverse=True)

@app.get("/admin/chat_logs/{filename}")
async def get_chat_log_content(filename: str, auth: bool = Depends(verify_admin)):
    """Xem nội dung chi tiết của một tệp nhật ký chat"""
    file_path = LOGS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp nhật ký")
    
    logs = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc tệp: {str(e)}")

# --- CHAT ENDPOINTS ---

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest = Body(...)):
    try:
        user_query = ""
        for msg in reversed(request.messages):
            if msg.role == "user":
                user_query = msg.content
                break
        
        # --- NÂNG CẤP RETRIEVAL (BƯỚC 1: TRUY XUẤT) ---
        context_str = ""
        is_web_search = request.search_web

        if is_web_search:
            try:
                print(f"[SEARCH] Đang tìm kiếm trên Internet: {user_query}")
                search_results = search_tool.run(user_query)
                context_str = f"THÔNG TIN TỪ INTERNET:\n{search_results}"
            except Exception as e:
                print(f"Search Error: {e}")
                context_str = "Không thể tìm kiếm internet lúc này."

        elif user_query and _global_retriever:
            try:
                q_lower = user_query.lower()
                # 1. TRUY XUẤT HỖN HỢP (Hybrid: Vector + Keyword via Metadata)
                all_data = _global_retriever.vectorstore.get()
                all_metas = all_data["metadatas"]
                all_docs = all_data["documents"]

                # GIỮ LẠI: 'số', 'điện', 'thoại', 'email' vì đây là mục tiêu tìm kiếm
                # LOẠI BỎ THÊM: 'thế', 'nào', 'sao' để tránh nhầm với tên người
                stop_words = ["cho", "tôi", "xin", "là", "gì", "của", "ai", "anh", "chị", "em", "nhân", "viên", "phòng", "ban", "danh", "sách", "liệt", "kê", "sự", "bộ", "phận", "hãy", "giúp", "thế", "nào", "làm", "sao", "bao", "nhiêu"]
                keywords = [w for w in q_lower.split() if w not in stop_words and len(w) >= 2]
                
                # 1. PHÂN TÍCH TRUY VẤN
                is_list_request = any(w in q_lower for w in ["danh sách", "liệt kê", "tất cả", "những ai", "danh sach", "bảng"])
                is_news_request = any(w in q_lower for w in ["thông báo", "tin tức", "lịch", "nghỉ", "tết", "quy định", "chính sách"])
                
                # ... (giữ nguyên logic matching_depts) ...
                matching_depts = []
                all_possible_depts = set(str(m.get("dept", "")).lower() for m in all_metas)
                for d in all_possible_depts:
                    for k in keywords:
                        if k == "r&d" and "r&d" in d:
                            matching_depts.append(d)
                            break
                        elif len(k) >= 3 and k in d:
                            matching_depts.append(d)
                            break
                
                final_context_parts = []
                seen_names = set()

                # A. TÌM KIẾM NHÂN SỰ THEO TỪ KHÓA
                scored_results = []
                for i, meta in enumerate(all_metas):
                    name = str(meta.get("name", "")).lower()
                    dept = str(meta.get("dept", "")).lower()
                    # Chỉ match tên nếu nó không phải là từ khóa thông thường của tin tức
                    if not is_news_request or any(k in name for k in keywords if k not in ["lịch", "nghỉ", "tết"]):
                        score = sum(200 for k in keywords if k in name and (len(k) >= 3 or k == "r&d"))
                        score += sum(100 for k in keywords if k in dept and (len(k) >= 3 or k == "r&d"))
                        if score > 0: scored_results.append((score, i))

                if scored_results:
                    scored_results.sort(key=lambda x: x[0], reverse=True)
                    max_score = scored_results[0][0]
                    for score, idx in scored_results:
                        if score < max_score * 0.5: break
                        meta = all_metas[idx]
                        ename = meta.get("name")
                        if ename and ename not in seen_names:
                            parent_doc = next((all_docs[j] for j, m in enumerate(all_metas) if m.get("name") == ename and m.get("doc_type") == "parent"), all_docs[idx])
                            final_context_parts.append(parent_doc)
                            seen_names.add(ename)
                        if not is_list_request and len(final_context_parts) >= 3: break

                # B. TÌM KIẾM THÔNG BÁO / TIN TỨC (Semantic Search Fallback/Combine)
                if is_news_request or not final_context_parts:
                    news_docs = _global_retriever.invoke(user_query)
                    for d in news_docs:
                        if d.page_content not in final_context_parts:
                            final_context_parts.append(d.page_content)
                    print(f"[DEBUG] Đã bổ sung {len(news_docs)} kết quả tìm kiếm ngữ nghĩa.")

                if final_context_parts:
                    # Dọn dẹp context: Loại bỏ hoàn toàn các dòng chứa thông tin nhạy cảm (CCCD, CMND, MST, etc.)
                    cleaned_context_parts = []
                    sensitive_patterns = ["CCCD", "CMND", "SỐ THẺ", "MÃ SỐ THUẾ", "MST", "PASSWORD", "MẬT KHẨU"]
                    
                    for doc in final_context_parts:
                        lines = doc.split("\n")
                        # Chỉ giữ lại các dòng KHÔNG chứa từ khóa nhạy cảm
                        safe_lines = [l for l in lines if not any(p in l.upper() for p in sensitive_patterns)]
                        if safe_lines:
                            cleaned_context_parts.append("\n".join(safe_lines))

                    # CONTEXTUAL COMPRESSION (Áp dụng trên context đã sạch)
                    if not is_list_request and not is_news_request:
                        compressed_parts = []
                        for doc in cleaned_context_parts:
                            if "HÀNH CHÍNH" in doc.upper() or "THÔNG BÁO" in doc.upper(): 
                                compressed_parts.append(doc)
                                continue
                            lines = doc.split("\n")
                            important = [l for l in lines if any(h in l.upper() for h in ["HỒ SƠ", "HỌ VÀ TÊN", "BỘ PHẬN"])]
                            target_keywords = keywords + ["số", "điện", "thoại", "sđt", "email"]
                            relevant = [l for l in lines if any(k in l.lower() for k in target_keywords) and l not in important]
                            compressed_parts.append("\n".join(important + relevant))
                        context_str = "\n\n---\n\n".join(compressed_parts)
                    else:
                        context_str = "\n\n---\n\n".join(cleaned_context_parts)
                else:
                    context_str = ""


            except Exception as e:
                print(f"Retrieval Error: {e}")

        # --- NÂNG CẤP GENERATION (BƯỚC 2: TẠO NỘI DUNG) ---
        from datetime import datetime
        current_time = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        
        system_content = (
            f"Bạn là Trợ lý AI chuyên trách nhân sự và thông tin công ty NHTC. Hôm nay là ngày {current_time}.\n"
            "NHIỆM VỤ: Trả lời câu hỏi dựa trên cung cấp trong phần 'DỮ LIỆU NGỮ CẢNH' hoặc kiến thức chung nếu phù hợp.\n\n"
            "QUY TẮC QUAN TRỌNG:\n"
            "1. BẢO MẬT (TUYỆT ĐỐI): Không bao giờ hiển thị Số CCCD, CMND, Mã số thuế, Mật khẩu hoặc Thông tin lương của bất kỳ ai ngay cả khi có trong ngữ cảnh. Chỉ cung cấp: Họ tên, Phòng ban, Chức vụ, Email, và Số điện thoại liên lạc.\n"
            "2. ĐỐI VỚI THÔNG TIN CÔNG TY/NHÂN SỰ: Chỉ sử dụng thông tin trong 'DỮ LIỆU NGỮ CẢNH'. Tuyệt đối không tự bịa thông tin. Thừa nhận nếu không tìm thấy thông tin.\n"
            "3. ĐỐI VỚI KIẾN THỨC CHUNG/CHÀO HỎI: Trả lời lịch sự, chuyên nghiệp.\n"
            "4. TRÌNH BÀY: Dùng Markdown Table cho danh sách nhân sự. Giữ nguyên tên đầy đủ."
        )
        
        # --- CHHUYỂN ĐỔI SANG ĐỊNH DẠNG GEMINI ---
        history = []
        for m in request.messages[:-1]:
            role = "user" if m.role == "user" else "model"
            history.append({"role": role, "parts": [m.content]})
            
        # Kiểm tra xem model có hỗ trợ system_instruction không (Gemma thường không hỗ trợ trực tiếp qua SDK cũ)
        if "gemma" in GEMINI_MODEL_NAME.lower():
            model = genai.GenerativeModel(model_name=GEMINI_MODEL_NAME)
            # Đối với Gemma, ta đưa system instruction vào làm message đầu tiên hoặc trộn vào prompt
            prompt = f"{system_content}\n\n---\nDỮ LIỆU NGỮ CẢNH:\n{context_str}\n\nCÂU HỎI: {user_query}"
        else:
            model = genai.GenerativeModel(
                model_name=GEMINI_MODEL_NAME,
                system_instruction=system_content
            )
            prompt = f"DỮ LIỆU NGỮ CẢNH:\n{context_str}\n\nCÂU HỎI: {user_query}"
        
        chat = model.start_chat(history=history)

        if request.stream:
            # Lấy toàn bộ text để log (với stream)
            full_response_text = ""
            def generate_stream():
                nonlocal full_response_text
                try:
                    response = chat.send_message(prompt, stream=True)
                    for chunk in response:
                        try:
                            content = chunk.text
                            if content:
                                full_response_text += content
                                yield f"data: {json.dumps({'choices': [{'delta': {'content': content}}]})}\n\n"
                        except (ValueError, AttributeError):
                            continue
                    
                    # Log sau khi stream xong
                    save_chat_log(request.device_id, user_query, full_response_text)
                    yield "data: [DONE]\n\n"
                except Exception as e:
                    print(f"Stream Error: {e}")
                    yield f"data: {json.dumps({'choices': [{'delta': {'content': f'Lỗi Gemini: {str(e)}'}}]})}\n\n"
                    yield "data: [DONE]\n\n"
            return StreamingResponse(generate_stream(), media_type="text/event-stream")
        
        else:
            response = chat.send_message(prompt)
            try:
                content = response.text
            except (ValueError, AttributeError):
                content = "Rất tiếc, AI không thể tạo câu trả lời cho nội dung này."
            
            # Log non-stream
            save_chat_log(request.device_id, user_query, content)
            return {"choices": [{"message": {"role": "assistant", "content": content}}]}
            
    except Exception as e:
        print(f"Global Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
