# API Dang ky tai khoan (Register)

Tai lieu mo ta chi tiet API dang ky tai khoan nguoi dung cho du an Website Ban Dien Thoai - Nhom 12.

---

## 1. Tong quan

| Thuoc tinh     | Gia tri                              |
| -------------- | ------------------------------------ |
| **Method**     | `POST`                               |
| **Endpoint**   | `/api/auth/register`                 |
| **Auth**       | Khong yeu cau                        |
| **Content-Type** | `application/json`                 |
| **Mo ta**      | Tao tai khoan moi voi username, email va password |

---

## 2. Request

### 2.1 Request Body

```json
{
  "username": "nguyenvana",
  "email": "nguyenvana@gmail.com",
  "password": "MatKhau123"
}
```

### 2.2 Chi tiet cac truong

| Truong       | Kieu     | Bat buoc | Mo ta                                                         |
| ------------ | -------- | -------- | ------------------------------------------------------------- |
| `username`   | `string` | Co       | Ten dang nhap. Chi cho phep chu cai, so va dau gach duoi (_). Do dai 3-30 ky tu. Phai la duy nhat trong he thong. |
| `email`      | `string` | Co       | Dia chi email. Phai dung dinh dang email hop le. Tu dong chuyen thanh chu thuong. Phai la duy nhat trong he thong. |
| `password`   | `string` | Co       | Mat khau. Toi thieu 6 ky tu. Se duoc hash bang bcrypt truoc khi luu vao database.  |

---

## 3. Response

### 3.1 Thanh cong (201 Created)

```json
{
  "status": 201,
  "message": "Dang ky thanh cong",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "username": "nguyenvana",
    "email": "nguyenvana@gmail.com",
    "role": "USER",
    "hasPassword": true,
    "authProvider": "LOCAL",
    "createdAt": "2026-03-15T10:30:00.000Z"
  }
}
```

### 3.2 Loi validation (400 Bad Request)

**Thieu truong bat buoc:**
```json
{
  "status": 400,
  "message": "Vui long nhap day du thong tin dang ky",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "username": ["Vui long nhap ten dang nhap"],
    "email": ["Vui long nhap email"],
    "password": ["Vui long nhap mat khau"]
  }
}
```

**Mat khau qua ngan:**
```json
{
  "status": 400,
  "message": "Mat khau phai co it nhat 6 ky tu",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "password": ["Mat khau phai co it nhat 6 ky tu"]
  }
}
```

**Email khong hop le:**
```json
{
  "status": 400,
  "message": "Email khong hop le",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "email": ["Email khong hop le"]
  }
}
```

**Username khong hop le:**
```json
{
  "status": 400,
  "message": "Ten dang nhap chi duoc chua chu cai, so va dau gach duoi, dai 3-30 ky tu",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "username": ["Ten dang nhap chi duoc chua chu cai, so va dau gach duoi, dai 3-30 ky tu"]
  }
}
```

### 3.3 Trung du lieu (409 Conflict)

**Username da ton tai:**
```json
{
  "status": 409,
  "message": "Ten dang nhap da duoc su dung",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "username": ["Ten dang nhap da duoc su dung"]
  }
}
```

**Email da ton tai:**
```json
{
  "status": 409,
  "message": "Email da duoc su dung",
  "timestamp": "2026-03-15T10:30:00.000Z",
  "errors": {
    "email": ["Email da duoc su dung"]
  }
}
```

### 3.4 Loi server (500 Internal Server Error)

```json
{
  "status": 500,
  "message": "Loi server",
  "timestamp": "2026-03-15T10:30:00.000Z"
}
```

---

## 4. Quy trinh xu ly (Sequence Diagram)

```
Client (Frontend)                    Backend API                          MongoDB
      |                                  |                                   |
      |  POST /api/auth/register         |                                   |
      |  { username, email, password }   |                                   |
      |--------------------------------->|                                   |
      |                                  |                                   |
      |                                  |  1. Validate input                |
      |                                  |     - Kiem tra truong bat buoc    |
      |                                  |     - Kiem tra dinh dang username |
      |                                  |     - Kiem tra do dai password    |
      |                                  |     - Kiem tra dinh dang email    |
      |                                  |                                   |
      |                                  |  2. Kiem tra trung               |
      |                                  |     findOne({ username | email }) |
      |                                  |---------------------------------->|
      |                                  |          Ket qua kiem tra         |
      |                                  |<----------------------------------|
      |                                  |                                   |
      |                                  |  3. Tao user moi                  |
      |                                  |     User.create({...})            |
      |                                  |     (pre-save: hash password)     |
      |                                  |---------------------------------->|
      |                                  |          User da luu              |
      |                                  |<----------------------------------|
      |                                  |                                   |
      |                                  |  4. Tao JWT token                 |
      |                                  |     issueToken(user._id)          |
      |                                  |                                   |
      |     201 Created                  |                                   |
      |     { token, id, username, ... } |                                   |
      |<---------------------------------|                                   |
      |                                  |                                   |
      |  (Frontend hien thi              |                                   |
      |   man hinh thanh cong,           |                                   |
      |   chuyen sang form dang nhap)    |                                   |
```

---

## 5. Luu do xu ly chi tiet

```
                    POST /api/auth/register
                             |
                             v
                  +---------------------+
                  | Nhan request body    |
                  | {username,email,pw}  |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Trim username, email |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Thieu truong nao?    |----> Co --> 400: "Vui long nhap day du..."
                  +---------------------+           + errors theo tung truong
                             |
                             v (Du truong)
                  +---------------------+
                  | Username hop le?     |----> Khong --> 400: "Username khong hop le"
                  | (a-z, 0-9, _, 3-30) |
                  +---------------------+
                             |
                             v (Hop le)
                  +---------------------+
                  | Password >= 6 ky tu? |----> Khong --> 400: "Mat khau qua ngan"
                  +---------------------+
                             |
                             v (Du dai)
                  +---------------------+
                  | Email hop le?        |----> Khong --> 400: "Email khong hop le"
                  +---------------------+
                             |
                             v (Hop le)
                  +---------------------+
                  | Tim username/email   |
                  | trong MongoDB        |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Da ton tai?          |----> Co --> 409: "Username/Email da su dung"
                  +---------------------+
                             |
                             v (Chua ton tai)
                  +---------------------+
                  | User.create(...)     |
                  | (auto hash password) |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Tao JWT token        |
                  | (het han: 7 ngay)    |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Tra ve 201 Created   |
                  | { token, user info } |
                  +---------------------+
```

---

## 6. Bao mat

### 6.1 Hash mat khau
- Su dung **bcryptjs** voi **10 salt rounds**
- Hash duoc thuc hien tu dong qua Mongoose `pre-save` hook
- Mat khau goc **khong bao gio** duoc luu vao database

### 6.2 JWT Token
- Su dung thu vien **jsonwebtoken**
- Secret key: bien moi truong `JWT_SECRET`
- Thoi gian het han: **7 ngay**
- Payload: `{ userId: "<MongoDB ObjectId>" }`

### 6.3 Sanitize response
- Ham `sanitizeUser()` loai bo `password`, `__v` truoc khi tra ve client
- Chuyen `_id` thanh `id` de nhat quan voi frontend

---

## 7. Frontend - Xu ly phia client

### 7.1 Validation phia client (truoc khi goi API)

| Kiem tra              | Dieu kien                                | Thong bao loi                              |
| --------------------- | ---------------------------------------- | ------------------------------------------ |
| Email hop le          | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`   | "Vui long nhap dia chi email hop le"       |
| Dong y dieu khoan     | Checkbox da check                        | "Vui long dong y voi dieu khoan su dung"   |
| Mat khau khop         | password === confirmPassword             | "Mat khau nhap lai khong khop"             |
| Do dai mat khau       | password.length >= 6                     | "Mat khau phai co it nhat 6 ky tu"         |
| Username hop le       | Regex: `/^[a-zA-Z0-9_]{3,30}$/`         | "Ten dang nhap khong hop le"               |

### 7.2 Do manh mat khau (hien thi tren giao dien)

| Muc     | Dieu kien                                          | Mau sac       |
| ------- | -------------------------------------------------- | ------------- |
| Yeu     | < 6 ky tu hoac diem <= 2                           | Do (red-500)  |
| Trung binh | Diem 3                                           | Vang (yellow-500) |
| Manh    | Diem 4                                             | Xanh (green-500) |
| Rat manh | Diem 5                                            | Xanh dam (green-600) |

Cach tinh diem: +1 cho moi tieu chi dat: do dai >= 6, do dai >= 8, co chu hoa, co so, co ky tu dac biet.

### 7.3 Luong xu ly sau dang ky thanh cong

1. API tra ve 201 -> Frontend hien thi man hinh "Dang ky thanh cong!"
2. Nguoi dung nhan "Dang nhap ngay" -> Chuyen sang form dang nhap
3. **Khong tu dong dang nhap** sau khi dang ky (nguoi dung phai nhap lai thong tin)

---

## 8. Test API bang cURL

### 8.1 Dang ky thanh cong

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser01",
    "email": "testuser01@gmail.com",
    "password": "Test@123"
  }'
```

### 8.2 Dang ky voi username da ton tai

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "email": "newemail@gmail.com",
    "password": "Test@123"
  }'
```

### 8.3 Dang ky voi email khong hop le

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "invalid-email",
    "password": "Test@123"
  }'
```

### 8.4 Dang ky voi mat khau qua ngan

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@gmail.com",
    "password": "123"
  }'
```

---

## 9. Cac file lien quan

| File                                    | Mo ta                                        |
| --------------------------------------- | -------------------------------------------- |
| `backend/src/routes/auth.js`            | Route handler cho register va login          |
| `backend/src/models/User.js`            | Mongoose schema, pre-save hash, comparePassword |
| `backend/src/data/store.js`             | issueToken, verifyToken, sanitizeUser        |
| `backend/src/lib/apiResponse.js`        | Ham ok() va fail() tao response chuan        |
| `backend/src/middleware/auth.js`        | Middleware xac thuc JWT                      |
| `frontend/src/pages/Auth.tsx`           | Trang dang nhap/dang ky                      |
| `frontend/src/api/endpoints.ts`         | Dinh nghia endpoint constants                |
| `frontend/src/api/client.ts`            | Axios client voi interceptors                |
| `frontend/src/store/useAuthStore.ts`    | Zustand store quan ly trang thai auth        |

---

## 10. Lich su thay doi

| Ngay       | Mo ta                                                    |
| ---------- | -------------------------------------------------------- |
| 2026-03-15 | Tao tai lieu, hoan thien validation username va error response chi tiet |
