# 풍무농산 주문서

정적 주문서 + 관리자 페이지 구조입니다.

## 파일

- `index.html`: 고객용 주문서
- `admin.html`: 관리자용 주문/재고 관리 페이지
- `app-config.js`: 실행 모드 설정
- `shared.js`: 주문 저장/설정 저장 공용 로직
- `admin.js`: 관리자 페이지 동작

## Git 올리기

```powershell
git init
git add .
git commit -m "feat: add fruit order form with admin dashboard"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 배포

### GitHub Pages

1. GitHub 저장소에 업로드
2. 저장소 `Settings`
3. `Pages`
4. `Deploy from a branch`
5. `main` / `/root`
6. 저장 후 배포 주소 확인

### 접속 경로

- 고객 주문서: `/index.html`
- 관리자 페이지: `/admin.html`

## 현재 데모 모드

`app-config.js` 기본값은 `demo` 입니다.

- 주문은 현재 브라우저 `localStorage`에 저장됩니다.
- 관리자 페이지에서도 같은 브라우저에서만 보입니다.

## 실운영 모드 전환

`app-config.js`를 다음처럼 수정하세요.

```js
window.ORDER_APP_CONFIG = {
  mode: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  settingsRowId: "main"
};
```

그리고 `mode`를 `supabase`로 바꾸세요.

```js
window.ORDER_APP_CONFIG = {
  mode: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  settingsRowId: "main"
};
```

## Supabase 설정 순서

1. Supabase에서 새 프로젝트 생성
2. `Authentication > Sign In / Providers`에서 `Email` 활성화
3. `SQL Editor`에서 [`supabase-setup.sql`](./supabase-setup.sql) 실행
4. `Project Settings > API`에서 `Project URL`, `anon public key` 복사
5. `app-config.js`에 값 입력
6. `mode: "supabase"`로 변경
7. 관리자 페이지 `admin.html`에서 관리자 이메일로 매직링크 로그인

## Supabase SQL 예시

아래 SQL은 [`supabase-setup.sql`](./supabase-setup.sql) 와 동일합니다.

```sql
create table if not exists public.store_settings (
  id text primary key,
  settings jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  apartment_name text not null,
  address_detail text not null,
  gate_code text,
  delivery_type text,
  pay_method text,
  memo text,
  items jsonb not null,
  total_amount integer not null default 0,
  order_text text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
```

## 관리자 로그인

- `admin.html` 접속
- 관리자 이메일 입력
- `매직링크 보내기`
- 받은 메일에서 링크 클릭
- 다시 `admin.html` 열기

실운영 모드에서는 로그인한 사용자만 주문 목록 조회/상태 수정/재고 저장이 가능합니다.

## 관리자 확인 위치

- 데모 모드: `admin.html`에서 같은 브라우저 기준 확인
- Supabase 모드: 어떤 기기에서든 `admin.html`에서 공통 확인

## 주의

- 현재 관리자 인증은 없습니다.
- 실배포 전에는 관리자 페이지 주소를 비공개로 두는 수준이 아니라, 나중에 로그인 보호를 넣는 것이 안전합니다.
