# Cau truc he thong

Tai lieu nay tom tat cau truc hien tai cua repo de nhom de phan cong va mo rong.

## Thu muc goc

- `frontend/`: ung dung React + Vite + TypeScript
- `backend/`: ung dung Node.js + Express
- `docs/`: tai lieu nghiep vu, cau truc va mo hinh du lieu
- `.github/`: workflow CI

## Frontend

- `src/api/`: cau hinh client, endpoint, kieu du lieu API
- `src/components/`: component dung chung
- `src/pages/`: page theo route
- `src/router/`: cau hinh route
- `src/store/`, `src/stores/`: state quan ly bang Zustand
- `src/hooks/`: custom hooks
- `src/types/`: type dung chung
- `src/data/`: du lieu tam phuc vu giao dien

## Backend

- `src/app.js`: khoi tao middleware va dang ky route
- `src/server.js`: chay server
- `src/routes/`: route theo tung module
- `src/data/store.js`: du lieu mock/in-memory hien tai
- `src/lib/`: helper dung chung
- `src/middleware/`: middleware auth va xu ly chung
- `test/`: test backend co ban

## Nguyen tac phat trien tiep

- Story frontend uu tien them vao `src/pages`, `src/components`, `src/store`
- Story backend uu tien mo rong trong `src/routes`, `src/data`, `src/lib`
- Tai lieu va quy uoc mo rong them trong `docs/`
