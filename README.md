# 스탬퍼스 재무 콘솔

주식회사 스탬퍼스 대표자 전용 내부 재무 도구입니다. 공식 법인세·부가세 신고는
세무사랑 Pro(세무법인 정윤)가 계속 담당하며, 이 앱은 그 결산 자료를 바탕으로
매달 스스로 확인해야 할 리스크를 추적하기 위한 보조 콘솔입니다.

## 기능

- **자본잠식·런웨이 계기판** — 분기/연도별 스냅샷으로 자본잠식률과 현금 런웨이를 자동 계산
- **차입금 원장** — 대표자·임직원(특수관계자) 차입금과 외부 차입금을 구분 관리, 저금리 차입은 인정이자 점검 배지 표시
- **원가율 모니터** — 비용 항목별 매출 대비 비율을 추적하고 항목별 상한을 넘으면 경고
- **결손금·손익분기 추적기** — 이월결손금 잔액·소멸시한과 손익분기까지 부족한 매출을 계산

## 스택

- Vite + React + TypeScript
- [Supabase](https://supabase.com) (Postgres + Auth + RLS) — 기존 STAMPERS 프로젝트에 `finance_` 접두사 테이블로 격리
- 인증: 이메일 매직링크(OTP), 대표자 이메일 1인만 RLS로 접근 허용

## 로컬 실행

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_FOUNDER_EMAIL 채우기
npm run dev
```

`.env`는 절대 커밋하지 않습니다(`.gitignore` 처리됨).

## 데이터베이스

`public.finance_company`, `finance_snapshots`, `finance_loans`,
`finance_loan_transactions`, `finance_expense_categories`,
`finance_period_expenses`, `finance_nol_carryforwards` 테이블로 구성되며,
모든 테이블에 RLS가 걸려 있어 `VITE_FOUNDER_EMAIL`로 로그인한 계정만
읽고 쓸 수 있습니다. 마이그레이션 SQL은 저장소에는 없고 Supabase 프로젝트에
직접 적용되어 있습니다.

## 현재 범위(v1)

조회 + 신규 추가만 지원합니다. 수정/삭제 UI는 아직 없습니다.
