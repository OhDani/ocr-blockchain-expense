# 📋 FlexiTrip — Project Brief & System Architecture Brainstorm

> **FlexiTrip**: Hệ thống quản lý chi phí công tác doanh nghiệp tự động hóa end-to-end, tích hợp **Google SSO**, **AI Multimodal OCR (Gemini Vision)**, **Fraud Detection Engine** và **Blockchain Smart Contracts (vVND)**.

---

## 1. Bối Cảnh & Bài Toán Doanh Nghiệp (Problem Statement)

### 1.1. Nỗi đau thực tế trong doanh nghiệp (Pain Points)
1. **Quy trình thủ công, tốn kém thời gian**:
   - Nhân viên phải thu thập hóa đơn giấy, hóa đơn điện tử rời rạc suốt chuyến công tác.
   - Nhập liệu thủ công vào bảng tính dễ sai sót (nhầm số tiền, nhầm ngày, nhầm mã số thuế).
2. **Kẽ hở gian lận chi phí (Expense Fraud)**:
   - **Nộp trùng hóa đơn**: Cùng một hóa đơn ăn uống/khách sạn nộp nhiều lần hoặc chia cho đồng nghiệp cùng nộp.
   - **Hóa đơn bất thường**: Ăn uống lúc nửa đêm (1h-5h sáng), hóa đơn phát sinh ngoài thời gian/địa điểm công tác.
   - **Sửa chữa chứng từ**: Kê khống số tiền hoặc gian lận chi phí cá nhân thành chi phí công ty.
3. **Quy trình phê duyệt và giải ngân chậm trễ**:
   - Hồ sơ thanh toán mất từ 14 - 30 ngày để luân chuyển qua nhiều phòng ban.
   - Nhân viên bị chiếm dụng vốn cá nhân trong thời gian dài.
4. **Thiếu minh bạch và rủi ro kiểm toán nội bộ**:
   - Dữ liệu kế toán lưu trong cơ sở dữ liệu tập trung (SQL/NoSQL) có thể bị sửa đổi hoặc xóa lịch sử bởi người có quyền quản trị tối cao (Admin / DBA).

### 1.2. Giải pháp FlexiTrip
FlexiTrip chuyển đổi mô hình từ **"Thủ công - Chậm trễ - Dễ gian lận"** sang **"Tự động hóa - Thời gian thực - Minh bạch bất biến"**:
- **Google Workspace SSO**: Đăng nhập 1-click bằng tài khoản công vụ, tự động nhận diện nhân sự công ty.
- **AI OCR (Gemini 2.0 Flash Vision)**: Bóc tách hóa đơn JSON chính xác trong 2 giây.
- **Policy Engine**: Đối chiếu tức thì hạn mức tài chính theo chức danh.
- **Fraud Detection Engine**: Kiểm tra chéo đa lớp (AI Anomaly Score + 4 Heuristics chống trùng lặp, lệch ngày, giờ khuya).
- **Blockchain Smart Contract (vVND)**: Tự động hóa hoàn ứng qua hợp đồng thông minh, ghi nhận bằng chứng bất biến (Immutable Audit Trail) trên sổ cái phân tán.

---

## 2. Quản Lý Danh Tính Doanh Nghiệp Với Google Login (Company Identity)

> **CÂU HỎI NGHIỆP VỤ**: *Khi người dùng đăng nhập bằng Google, làm thế nào Admin và Kế toán xác định họ thuộc công ty để quản lý, tránh người ngoài dùng Gmail lạ truy cập?*

FlexiTrip áp dụng mô hình bảo mật kết hợp **3 lớp nhận diện**:

```
[Đăng nhập bằng Google]
           │
           ▼
[Lớp 1: Domain Whitelist] ──(Khác Domain công ty)──▶ [CHẶN ĐĂNG NHẬP NGAY]
(VD: @company.com / @fpt.edu.vn)
           │ (Khớp Domain)
           ▼
[Lớp 2: Kiểm tra Danh sách Nhân sự (Pre-registration / Invite)]
           │
     ┌─────┴───────────────────────────────────┐
     ▼                                         ▼
[Đã được tạo sẵn trong hệ thống]     [Chưa có trong danh sách phòng ban]
(Admin/Trưởng phòng đã add trước)              │
     │                                         ▼
     │                               [Lớp 3: Trạng thái PENDING_ASSIGNMENT]
     │                               (Chờ Trưởng phòng/Admin duyệt phòng ban)
     │                                         │
     └───────────────────┬─────────────────────┘
                         ▼
             [VÀO HỆ THỐNG LÀM VIỆC]
```

1. **Lớp 1 — Domain Whitelisting (Khuyên dùng)**: Hệ thống chỉ chấp nhận email có đuôi tên miền công ty (ví dụ `@company.vn` hoặc `@fpt.edu.vn`). Email cá nhân `@gmail.com` thông thường sẽ bị từ chối ngay ở bước xác thực.
2. **Lớp 2 — Pre-registration (Tạo trước danh sách)**: Admin hoặc Trưởng phòng tạo trước danh sách nhân viên kèm email công vụ. Khi nhân viên bấm "Sign in with Google", hệ thống tự động khớp email và kích hoạt tài khoản.
3. **Lớp 3 — Phê duyệt thành viên mới (Self-service + Approval)**: Nếu doanh nghiệp dùng email linh hoạt, khi nhân viên mới đăng nhập lần đầu, tài khoản ở trạng thái `PENDING_ASSIGNMENT`. Trưởng phòng hoặc Admin chỉ cần 1-click gán vào phòng ban tương ứng là nhân viên bắt đầu hoạt động.

---

## 3. Chân Dung 3 Cấp Phân Quyền Cốt Lõi (3-Tier RBAC Architecture)

Hệ thống thiết kế theo đúng mô hình quản trị tài chính doanh nghiệp 3 cấp bậc chuẩn:

| Vai trò (Role) | Trách nhiệm chính | Đặc quyền & Chức năng nổi bật |
|---|---|---|
| **1. ADMIN**<br>*(Ban Giám Đốc kiêm Kế toán trưởng / Finance Controller)* | **Kiểm soát tài chính tối cao & Thực thi giải ngân on-chain**. | • Quản lý phòng ban, toàn bộ nhân sự công ty.<br>• Thiết lập định mức chi tiêu theo chức danh (Policy Limits).<br>• Nạp quỹ Smart Contract Pool.<br>• **Thẩm định chi phí, duyệt hóa đơn & Ký lệnh hoàn ứng on-chain (Linea Sepolia L2)**.<br>• Xuất báo cáo tài chính kiểm toán (PDF, Excel) & Nhật ký kiểm toán. |
| **2. MANAGER**<br>*(Trưởng phòng / Quản lý bộ phận)* | **Quản lý kế hoạch công tác & Hoạt động của phòng ban**.<br>*(Lưu ý: Không can thiệp quỹ tiền on-chain)*. | • Duyệt trạng thái chuyến công tác cho nhân viên phòng mình (`PLANNED` ➔ `ONGOING` ➔ `COMPLETED`).<br>• Thêm, chỉnh sửa, theo dõi lịch trình hoạt động (Activities) của chuyến đi.<br>• Theo dõi tiến độ công tác và các chuyến đi của phòng ban.<br>• Đôn đốc nhân viên nộp chứng từ và hoàn thành kế hoạch. |
| **3. EMPLOYEE**<br>*(Nhân viên / Người đi công tác)* | Thực thi công tác & Nộp chứng từ hoàn ứng. | • Đăng nhập Google SSO (Domain Whitelist) hoặc tài khoản nội bộ.<br>• Tạo chuyến công tác, đặt dự trù kinh phí.<br>• Chụp ảnh hóa đơn, hệ thống tự nén Full HD Canvas và kích hoạt Gemini AI OCR trích xuất.<br>• **Liên kết ví MetaMask cá nhân qua Chữ ký số mật mã EIP-191** (Zero Private-Key Leakage).<br>• Nhận tiền hoàn ứng vVND trực tiếp vào ví sau khi được duyệt. |

---

## 4. Ma Trận Phân Quyền Chi Tiết (RBAC Matrix)

> **Nguyên tắc phân quyền**: Trưởng phòng (**Manager**) tập trung vào quản lý kế hoạch và công việc phòng ban; Kế toán trưởng / Giám đốc (**Admin**) nắm quyền kiểm soát tài chính, chính sách hạn mức và ký lệnh giải ngân on-chain; Nhân viên (**Employee**) tạo chuyến và nộp chứng từ.

| Mã Quyền Hạn (Permission Code) | Mô Tả Quyền | ADMIN | MANAGER | EMPLOYEE |
|---|---|:---:|:---:|:---:|
| `trip:create_own` | Tạo chuyến công tác cho chính mình | ✅ | ✅ | ✅ |
| `trip:manage_dept` | Duyệt trạng thái chuyến đi (`ONGOING`, `COMPLETED`) cho nhân viên phòng ban | ✅ | ✅ | ❌ |
| `trip:view_dept` | Xem toàn bộ chuyến đi trong phòng ban | ✅ | ✅ | ❌ |
| `trip:view_all` | Xem toàn bộ chuyến công tác công ty | ✅ | ❌ | ❌ |
| `expense:upload` | Tải lên hóa đơn & chạy Nén ảnh + AI Vision OCR | ✅ | ✅ | ✅ |
| `expense:view_own` | Xem chi phí cá nhân | ✅ | ✅ | ✅ |
| `expense:view_all` | Xem toàn bộ chi phí toàn công ty | ✅ | ❌ | ❌ |
| `expense:approve` | **Duyệt hóa đơn & Ký lệnh giải ngân Blockchain L2** | ✅ | ❌ *(Không can thiệp ví quỹ)* | ❌ |
| `expense:reject` | **Từ chối hóa đơn & ghi rõ lý do** | ✅ | ❌ | ❌ |
| `policy:manage` | Cấu hình hạn mức chi tiêu theo chức danh (Policy Limits) | ✅ | ❌ | ❌ |
| `pool:fund` | Nạp tiền vào quỹ Smart Contract Pool trên Linea L2 | ✅ | ❌ | ❌ |
| `report:export` | Xuất báo cáo tài chính PDF & Excel | ✅ | ❌ | ❌ |
| `user:manage_all` | Quản lý người dùng, phân quyền phòng ban | ✅ | ❌ | ❌ |
| `wallet:link_eip191` | Ký xác thực chữ ký số liên kết ví MetaMask cá nhân | ✅ | ✅ | ✅ |

---

## 5. Luồng Xử Lý Hóa Đơn & Hoàn Ứng Chuẩn Doanh Nghiệp

```
[Nhân viên Upload Hóa đơn]
           │
           ▼
[AI Vision OCR bóc tách JSON + Tính SHA-256 Hash]
           │
           ▼
┌──────────────────────────────────────────────┐
│  KIỂM TRA TỰ ĐỘNG (POLICY & FRAUD DETECTION) │
│  - Kiểm tra định mức chức vụ & ngân sách trip│
│  - Kiểm tra giờ khuya (1AM-5AM) & số tròn    │
│  - Kiểm tra trùng lặp MST + Số HĐ            │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[HỢP LỆ 100% & KHÔNG RỦI RO]   [CÓ CỜ RỦI RO / GIAN LẬN]
(FraudScore = 0 & Policy VALID)(FraudScore > 0 hoặc Vi phạm Policy)
       │                               │
       │                               ▼
       │                    [Trạng thái: PENDING REVIEW]
       │                               │
       │                    [Kế toán thẩm định chứng từ]
       │                               │
       │                    ┌──────────┴──────────┐
       │                    ▼                     ▼
       │               [TỪ CHỐI]             [DUYỆT ĐẶC CÁCH]
       │                    │                     │
       │                    ▼                     │
       │             (Status: REJECTED)           │
       │             (Ghi chú lý do)              │
       │                                          │
       └────────────────────┬─────────────────────┘
                            ▼
             [Kế toán bấm xác nhận giải ngân]
                            │
                            ▼
           [Backend Relayer ký Smart Contract]
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
submitExpenseFor()                    validateExpense()
 (Ghi nhận On-chain)                 (Smart Contract tự trừ quỹ)
                                               │
                                               ▼
                                      _reimburse() Thực thi
                                     (Chuyển vVND về ví NV)
                                               │
                                               ▼
                                   [Trạng thái: REIMBURSED]
                                   (Lưu TxHash + Link Explorer)
```

---

## 6. Trả Lời: Nên Để Admin Hay Trưởng Phòng Thêm Nhân Viên?

👉 **Giải pháp tối ưu: PHÂN CẤP THEO MÔ HÌNH HYBRID**:
1. **Admin**: Có quyền thêm nhân viên vào **bất kỳ phòng ban nào**, chỉ định vai trò (`MANAGER`, `EMPLOYEE`), và khóa/mở khóa tài khoản.
2. **Trưởng phòng (Manager)**: Được quyền quản lý nhân viên và duyệt chuyến công tác trong phòng ban của mình.
3. **Cơ chế tự đăng nhập Google (Self-Registration)**:
   - Nhân viên công ty có thể tự đăng nhập bằng Google.
   - Khi đăng nhập lần đầu, tài khoản ở trạng thái `CHỜ XẾP PHÒNG`.
   - Trưởng phòng chỉ cần bấm nút **"Tiếp nhận vào phòng"** là hoàn tất, không cần gõ tay họ tên hay email của nhân viên.
