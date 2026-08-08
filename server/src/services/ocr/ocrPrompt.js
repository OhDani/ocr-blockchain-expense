/**
 * ocrPrompt.js
 * Prompt template cho Gemini Vision API.
 * 
 * Yêu cầu AI đọc TẤT CẢ thông tin trên hóa đơn,
 * KHÔNG giới hạn trước danh sách trường cố định.
 */

export const OCR_PROMPT = `Bạn là chuyên gia đọc và trích xuất thông tin từ hóa đơn, biên lai, receipt, bill. Hãy đọc ảnh này và trích xuất TẤT CẢ thông tin bạn nhìn thấy.

YÊU CẦU:
1. Trả về DUY NHẤT một JSON object, không kèm text giải thích.
2. Trích xuất TẤT CẢ thông tin hiển thị trên hóa đơn — không bỏ sót trường nào.
3. Số tiền dùng kiểu number (ví dụ: 150000, KHÔNG phải "150,000" hay "150.000đ").
4. Ngày tháng dùng format DD/MM/YYYY.
5. Danh sách hàng hóa/dịch vụ đặt trong mảng "items", mỗi item là một object.
6. Tổng tiền thanh toán cuối cùng đặt trong trường "grand_total".
7. Mã số thuế người bán (nếu có) đặt trong trường "tax_id".
8. Chỉ trả về những gì THỰC SỰ có trên hóa đơn — KHÔNG bịa thêm thông tin không tồn tại.
9. Nếu không đọc rõ một giá trị, ghi null thay vì đoán.
10. Tự phát hiện loại hóa đơn và thêm trường "invoice_type" (ví dụ: "restaurant", "hotel", "supermarket", "taxi", "fuel", "airline", "medical", "other").

VÍ DỤ TRƯỜNG CÓ THỂ CÓ (tùy loại hóa đơn):
- store_name, store_address, store_phone, tax_id
- invoice_number, invoice_series, invoice_date, invoice_type
- buyer_name, buyer_address, buyer_tax_id
- items (mảng): name, quantity, unit, unit_price, total
- subtotal, discount, vat_rate, vat_amount, service_charge
- grand_total, payment_method, cashier, notes
- Và BẤT KỲ trường nào khác có trên hóa đơn

Lưu ý: Danh sách trên chỉ là GỢI Ý. Hóa đơn có trường nào thì trả về trường đó. Hỗ trợ mọi ngôn ngữ trên hóa đơn.`;
