import pandas as pd
import os
import re
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader

DATA_DIR = os.path.abspath("../data")
DB_DIR = os.path.abspath("./chroma_db_v3")

def load_data_personnel(xl, sheet_name):
    """Logic đặc biệt cho bảng danh sách nhân sự (Dựa trên cấu trúc row 6)"""
    docs = []
    try:
        header_row_idx = 6
        # Đọc headers để xử lý merge cells/duplicate
        df_headers = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=header_row_idx + 1).fillna("")
        
        final_headers = []
        h_main = df_headers.iloc[header_row_idx]
        h_top = df_headers.iloc[header_row_idx - 1]
        
        for i in range(len(h_main)):
            m = str(h_main[i]).strip()
            t = str(h_top[i]).strip()
            name = t if (not m or m.lower() == "nan") and t and t.lower() != "nan" else m
            if not name or name.lower() == "nan": name = f"Col_{i}"
            
            base = name
            idx = 1
            while name in final_headers:
                name = f"{base}_{idx}"
                idx += 1
            final_headers.append(name)
        
        df = pd.read_excel(xl, sheet_name=sheet_name, header=header_row_idx).fillna("")
        df.columns = final_headers
        
        for _, row in df.iterrows():
            ename = str(row.get('Họ và tên', '')).strip()
            if not ename or ename.lower() in ["nan", ""] or "danh sách" in ename.lower() or ename == "Họ và tên":
                continue
            
            dept = str(row.get('Phòng ban', '')).strip()
            # Thử nhiều cột khác nhau cho Chức vụ
            job = ""
            for job_col in ['Chức danh/Vị trí', 'Chức danh/vị trí', 'Chức vụ', 'Vị trí']:
                val = str(row.get(job_col, '')).strip()
                if val and val.lower() != "nan":
                    job = val
                    break
            
            print(f"Indexing: {ename} - {dept}")
            
            info = []
            important_info = {
                "Họ và tên": ename,
                "Phòng ban": dept,
                "Chức vụ": job,
                "Số điện thoại": str(row.get('Số điện thoại', '')).strip(),
                "Email": str(row.get('Email công việc', '')).strip(),
                "Số CCCD": str(row.get('Số CCCD', '')).strip(),
                "Ngày bắt đầu": str(row.get('Ngày bắt đầu', '')).strip(),
                "Ngày chính thức": str(row.get('Ngày chính thức', '')).strip(),
                "Loại hợp đồng": str(row.get('Loại hợp đồng', '')).strip(),
                "Trạng thái": str(row.get('Trạng thái', '')).strip()
            }
            
            for col in df.columns:
                val = str(row[col]).strip()
                if val and val.lower() not in ["nan", "0", "0.0", "nat", ""] and "Col_" not in col:
                    clean_col = col.replace('\n', ' ').strip()
                    if clean_col not in important_info:
                        info.append(f"- {clean_col}: {val}")
            
            if ename:
                # 1. TẠO PARENT DOCUMENT (Hồ sơ đầy đủ - Để AI trả lời)
                full_content = f"### HỒ SƠ CHI TIẾT: {ename.upper()}\n"
                full_content += f"- Họ và tên: {important_info['Họ và tên']}\n"
                full_content += f"- Bộ phận: {important_info['Phòng ban']}\n"
                full_content += f"- Chức vụ: {important_info['Chức vụ']}\n"
                full_content += f"- Số điện thoại: {important_info['Số điện thoại']}\n"
                full_content += f"- Email: {important_info['Email']}\n"
                full_content += f"- Số CCCD: {important_info['Số CCCD']}\n"
                full_content += f"- Ngày bắt đầu: {important_info['Ngày bắt đầu']}\n"
                full_content += f"- Ngày chính thức: {important_info['Ngày chính thức']}\n"
                full_content += f"- Loại hợp đồng: {important_info['Loại hợp đồng']}\n"
                full_content += f"- Trạng thái: {important_info['Trạng thái']}\n"
                if info:
                    full_content += "\n**Thông tin bổ sung:**\n" + "\n".join(info)

                common_metadata = {
                    "name": ename.lower(),
                    "dept": dept.lower(),
                    "job": job.lower(),
                    "source": "Danh sách nhân viên",
                    "doc_type": "parent"
                }
                
                # Nạp hồ sơ gốc
                docs.append(Document(page_content=full_content, metadata=common_metadata))

                # 2. TẠO SYNTHETIC QUESTIONS (Các câu hỏi giả định - Để tăng độ chính xác tìm kiếm)
                synthetic_queries = [
                    f"số điện thoại của {ename} là bao nhiêu?",
                    f"email của {ename} là gì?",
                    f"{ename} làm việc ở bộ phận nào?",
                    f"thông tin liên hệ của {ename}",
                    f"{ename} giữ chức vụ gì?",
                    f"tìm hồ sơ nhân viên {ename}"
                ]
                
                for q in synthetic_queries:
                    search_doc = f"Câu hỏi: {q}\nTrả về: Hồ sơ của {ename}"
                    meta_child = common_metadata.copy()
                    meta_child["doc_type"] = "child"
                    docs.append(Document(page_content=search_doc, metadata=meta_child))

    except Exception as e:
        print(f"Lỗi load sheet nhân sự: {e}")
    return docs

def load_generic_excel(xl, sheet_name, filename):
    """Load Excel thông thường"""
    docs = []
    try:
        df = pd.read_excel(xl, sheet_name=sheet_name).fillna("")
        for _, row in df.iterrows():
            items = []
            for k, v in row.to_dict().items():
                if str(v).strip() and str(v).lower() != "nan":
                    items.append(f"{k}: {v}")
            if items:
                content = f"NGUỒN: {filename} (Sheet: {sheet_name})\n" + " | ".join(items)
                docs.append(Document(page_content=content, metadata={"source": filename, "type": "excel"}))
    except Exception as e:
        print(f"Lỗi load sheet {sheet_name}: {e}")
    return docs

def load_all_data():
    """Hệ thống nạp dữ liệu đa năng từ folder data"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        return []
    
    all_docs = []
    print(f"--- Đang quét thư mục: {DATA_DIR} ---")
    
    for filename in os.listdir(DATA_DIR):
        file_path = os.path.join(DATA_DIR, filename)
        ext = os.path.splitext(filename)[1].lower()
        
        print(f"  > Đang xử lý: {filename}")
        try:
            if ext in [".xlsx", ".xls"]:
                xl = pd.ExcelFile(file_path)
                for sheet_name in xl.sheet_names:
                    if "danh sách nhân viên" in sheet_name.lower() or "nhân sự" in filename.lower():
                        all_docs.extend(load_data_personnel(xl, sheet_name))
                    else:
                        all_docs.extend(load_generic_excel(xl, sheet_name, filename))
            
            elif ext == ".pdf":
                try:
                    loader = PyPDFLoader(file_path)
                    all_docs.extend(loader.load())
                except:
                    print(f"      ! Không thể load PDF bằng PyPDF, bỏ qua.")
            
            elif ext in [".txt", ".md"]:
                loader = TextLoader(file_path, encoding='utf-8')
                all_docs.extend(loader.load())
            
            elif ext == ".csv":
                df = pd.read_csv(file_path).fillna("")
                for _, row in df.iterrows():
                    content = f"FILE: {filename}\n" + " | ".join([f"{k}: {v}" for k, v in row.to_dict().items() if str(v).strip()])
                    all_docs.append(Document(page_content=content, metadata={"source": filename}))
                    
        except Exception as e:
            print(f"  ! Lỗi khi load file {filename}: {e}")
            
    return all_docs

def get_vector_store(force_reload=False):
    embedding = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", 
        model_kwargs={'device': 'cpu'}
    )
    
    # Reset DB if forced or empty
    if force_reload or not os.path.exists(DB_DIR) or not os.listdir(DB_DIR):
        print("--- Đang xây dựng lại Vector Database từ toàn bộ folder data... ---")
        docs = load_all_data()
        if not docs:
            print("--- CẢNH BÁO: Không có dữ liệu để load! ---")
            return None
        return Chroma.from_documents(documents=docs, embedding=embedding, persist_directory=DB_DIR)
    
    return Chroma(persist_directory=DB_DIR, embedding_function=embedding)

def get_rag_retriever():
    vs = get_vector_store()
    if not vs: return None
    return vs.as_retriever(search_type="similarity", search_kwargs={"k": 5})

if __name__ == "__main__":
    # Test
    v = get_vector_store(force_reload=True)
    if v:
        print(f"Xong! Đã nạp {len(v.get()['ids'])} đoạn dữ liệu.")
