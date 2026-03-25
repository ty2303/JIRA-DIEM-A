# Web Ban Dien Thoai

Du an gom:

- `frontend`: sao chep tu frontend cua repo mau `J2EE_Nhom12`, dung React + Vite + TypeScript
- `backend`: moi khoi tao bang Node.js + Express, tra du lieu mock de frontend co the ket noi ngay

## Chay local

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend chay mac dinh tai `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chay mac dinh tai `http://localhost:5173`.

Trong moi truong dev, frontend nen duoc cau hinh goi truc tiep backend tai
`http://localhost:8080/api`. Neu can tao lai file env local, copy gia tri mau
tu `frontend/.env.example`.

## Tai khoan demo

- User: `demo` / `123456`
- Admin: `admin` / `admin123`

## CI

Repo dang dung workflow tach rieng giong repo mau:

- `.github/workflows/backend-ci.yml`
- `.github/workflows/frontend-ci.yml`

## Lenh da verify

### Backend

- `npm run lint`
- `npm test`
- `npm run build`

### Frontend

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Ghi chu

- Backend hien la scaffold Express voi du lieu in-memory, chua dung database that
- Frontend la ban goc tu repo mau, toi chi dieu chinh script test de hop voi CI hien tai
- `CODEOWNERS` da duoc doi sang `@ty2303`

## Tai lieu bo sung

- `docs/system-structure.md`: tom tat cau truc repo va phan vung module
- `docs/data-model.md`: mo ta mo hinh du lieu muc co so de chuyen sang DB that
